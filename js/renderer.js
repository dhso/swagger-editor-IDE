(function(window) {
	const electron = require('electron');
	const ipcRenderer = electron.ipcRenderer;
	const remote = electron.remote;
	const fs = require('fs');
	const path = require('path');
	const url = require('url');
	const http = require('http');
	const unzip = require('unzip2');
	let updating = false;
	let localConfig = {};
	let remoteConfig = {};

	function _quit() {
		remote.app.quit();
	}

	function _openDialog(callback) {
		remote.dialog.showOpenDialog({
			properties: [
				'openFile',
			],
			filters: [{
				name: 'Swagger File Type',
				extensions: ['yaml', 'yml']
			}, ]
		}, function(res) {
			callback(res[0]);
		});
	}

	function _readFileSync(file) {
		return fs.readFileSync(file, "utf-8");
	}

	function _writeFile(file, content, sucFnc, errFnc) {
		fs.writeFile(file, content, function(err) {
			if (err) {
				if (errFnc && typeof errFnc === "function") {
					errFnc(err);
				}
				return;
			}
			if (sucFnc && typeof sucFnc === "function") {
				sucFnc();
			}
		})
	}

	function _writeFileSync(file, content) {
		fs.writeFileSync(file, content);
	}

	function _mkdirs(dirname, mode, callback) {
		fs.exists(dirname, function(exists) {
			if (exists) {
				callback();
			} else {
				_mkdirs(path.dirname(dirname), mode, function() {
					fs.mkdir(dirname, mode, callback);
				});
			}
		});
	}

	function _mkdirsSync(dirname, mode) {
		if (fs.existsSync(dirname)) {
			return true;
		} else {
			if (_mkdirsSync(path.dirname(dirname), mode)) {
				fs.mkdirSync(dirname, mode);
				return true;
			}
		}
	}

	function _rmFile(file, callback) {
		fs.exists(file, function(exists) {
			if (exists) {
				fs.unlink(file, function(err) {
					callback();
				});
			}
		});
	}

	function _rmFileSync(file) {
		fs.exists(file, function(exists) {
			if (exists) {
				fs.unlinkSync(file);
			}
		});
	}

	ipcRenderer.on('menu:save', function() {
		window.saveFile();
	});

	ipcRenderer.on('menu:checkUpdate', function() {
		_checkUpdate();
	});

	function _setTitle(title) {
		ipcRenderer.send('app:title:set', remote.app.getName() + ' -- ' + title);
	}

	function _checkUpdate(weak) {
		if (updating) {
			if (!weak) {
				new Notification("Swagger Editor", {
					body: 'Downloading, please waiting...'
				})
			}
			return;
		}
		localConfig = JSON.parse(_readFileSync(path.join(__dirname, '../package.json'), "utf-8"));
		_httpGet(localConfig.server + localConfig.version + '/' + 'update.json', function(data) {
			remoteConfig = JSON.parse(data);
			if (remoteConfig.length > 0 && remoteConfig[0].version && _compareVersion(remoteConfig[0].version, localConfig.version)) {
				let detail = 'Update detail:\n\n';
				remoteConfig[0].detail.forEach(function(ele) {
					detail += ele + '\n';
				});
				detail += '\nClick [OK] to upgrade.';
				if (confirm(detail)) {
					_upgrade(localConfig.server + localConfig.version + '/' + 'update.zip');
					new Notification("Swagger Editor", {
						body: 'Start to download, do not quit！'
					})
				}
			} else {
				if (!weak) {
					new Notification("Swagger Editor", {
						body: 'This is the newest version！'
					})
				}
			}
		});
	}

	function _upgrade(url) {
		updating = true;
		_httpDownload(url, path.join(__dirname, '../download/update.zip'), function() {
			_unzipFile(path.join(__dirname, '../download/update.zip'), function() {
				new Notification("Swagger Editor", {
					body: 'Upgrade successed，please reopen the Swagger Editor !'
				})
			});
		});
	}

	function _compareVersion(curV, reqV) {
		//curV 远程版本, reqV 本地版本
		let result = false;
		if (curV && reqV) {
			//将两个版本号拆成数字  
			var arr1 = curV.split('.'),
				arr2 = reqV.split('.');
			var minLength = Math.min(arr1.length, arr2.length),
				position = 0,
				diff = 0;
			//依次比较版本号每一位大小，当对比得出结果后跳出循环  
			while (position < minLength && ((diff = parseInt(arr1[position]) - parseInt(arr2[position])) == 0)) {
				position++;
			}
			diff = (diff != 0) ? diff : (arr1.length - arr2.length);
			//若curV大于reqV，则返回true  
			result = diff > 0;
		}
		return result;
	}

	function _httpGet(url, callback) {
		http.get(url, function(res) {
			let resData = "";
			res.on("data", function(data) {
				resData += data;
			});
			res.on("end", function() {
				callback(resData);
			});
		}).on('error', function(e) {
			console.log("Got error: " + e.message);
		});
	}

	function _httpDownload(url, localPath, callback) {
		_mkdirsSync(path.join(localPath, '../'));
		let file = fs.createWriteStream(localPath);
		http.get(url, function(res) {
			console.log('downloading:', url);
			res.on("data", function(data) {
				file.write(data);
			});
			res.on("end", function() {
				file.end();
				console.log('downloaded:', url);
				callback();
			});
		}).on('error', function(e) {
			console.log("Got error: " + e.message);
		});
	}

	function _unzipFile(file, callback) {
		console.log('unziping:', file);
		fs.createReadStream(file).pipe(unzip.Extract({
			path: path.join(__dirname, '../')
		})).on('close', function() {
			updating = false;
			console.log('unziped:', file);
			callback();
		});
	}

	_setTitle(window.localStorage.getItem('swagger-editor-file-path') || '');
	_checkUpdate(true);

	this.Renderer = {
		quit: _quit,
		openDialog: _openDialog,
		setTitle: _setTitle,
		readFileSync: _readFileSync,
		writeFile: _writeFile,
		writeFileSync: _writeFileSync,
		ipcRenderer: ipcRenderer,
		remote: remote
	}

})(window);