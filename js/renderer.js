(function(window) {
	const electron = require('electron');
	const ipcRenderer = electron.ipcRenderer;
	const remote = electron.remote;
	const fs = require('fs');
	const path = require('path');
	const url = require('url');
	const http = require('http');
	let changeFilesOk = true;
	let removeFilesOk = true;
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
					body: '正在下载更新，请耐心等待！'
				})
			}
			return;
		}
		localConfig = JSON.parse(_readFileSync(path.join(__dirname, '../package.json'), "utf-8"));
		_httpGet(localConfig.server + localConfig.version + '/' + 'package.json', function(data) {
			remoteConfig = JSON.parse(data);
			if (remoteConfig.manifest && remoteConfig.manifest[0] && remoteConfig.manifest[0].version && _compareVersion(remoteConfig.manifest[0].version, localConfig.version)) {
				let detail = '本次更新如下:\n\n';
				remoteConfig.manifest[0].detail.forEach(function(ele) {
					detail += ele + '\n';
				});
				detail += '\n点击 [OK] 更新';
				if (confirm(detail)) {
					_updateFiles(remoteConfig.manifest[0].files);
					new Notification("Swagger Editor", {
						body: '开始下载更新，请不要退出！'
					})
				}
			} else {
				if (!weak) {
					new Notification("Swagger Editor", {
						body: '当前已是最新版本！'
					})
				}
			}
		});
	}


	function _updateFiles(files) {
		updating = true;
		_downloadFiles(files.change || []);
		_removeFiles(files.remove || []);
	}

	function _downloadFiles(files) {
		if (files && files.length > 0) {
			changeFilesOk = false;
		}
		fs.exists(path.join(__dirname, '../download'), function(exists) {
			let _files = [].concat(files);
			files.forEach(function(file) {
				_httpGet(localConfig.server + remoteConfig.manifest[0].version + '/' + file, function(data) {
					console.log('download:', file);
					_mkdirsSync(path.dirname(path.join(__dirname, '../download/', file)));
					_writeFileSync(path.join(__dirname, '../download/', file), data);
					let index = _files.indexOf(file);
					if (index > -1) {
						_files.splice(index, 1);
					}
					if (_files.length < 1) {
						console.log('download:', true);
						_changeFiles(files);
					}
				});
			});
		});
	}

	function _changeFiles(files) {
		let _files = [].concat(files);
		files.forEach(function(file) {
			console.log('change:', file);
			let data = _readFileSync(path.join(__dirname, '../download/', file));
			_mkdirsSync(path.dirname(path.join(__dirname, '../', file)));
			_writeFileSync(path.join(__dirname, '../', file), data);
			let index = _files.indexOf(file);
			if (index > -1) {
				_files.splice(index, 1);
			}
			if (_files.length < 1) {
				changeFilesOk = true;
				console.log('change:', changeFilesOk);
				_checkUpdateSuccess();
			}
		});
	}

	function _removeFiles(files) {
		if (files && files.length > 0) {
			removeFilesOk = false;
		}
		let _files = [].concat(files);
		files.forEach(function(file) {
			fs.unlink(path.join(__dirname, '../', file), function(err) {
				console.log('remove:', file);
				if (err) console.log(err);
				let index = _files.indexOf(file);
				if (index > -1) {
					_files.splice(index, 1);
				}
				if (_files.length < 1) {
					removeFilesOk = true;
					console.log('remove:', removeFilesOk);
					_checkUpdateSuccess();
				}
			});
		});
	}

	function _checkUpdateSuccess() {
		if (changeFilesOk && removeFilesOk) {
			updating = false;
			new Notification("Swagger Editor", {
				body: '更新成功，请重新打开 Swagger Editor !'
			})
		}
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