const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const Menu = electron.Menu;
const ipcMain = electron.ipcMain;
const path = require('path');
const fs = require('fs');
const url = require('url');
const http = require('http');


// require('electron-debug')({
//   showDevTools: false
// });

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 800,
    minHeight: 600,
    center: true,
    title: 'Swagger Editor',
    icon: path.join(__dirname, '../img/icon.png'),
    webPreferences: {
      webSecurity: false
    }
  });

  //mainWindow.loadURL('https://editor.swagger.io/');

  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../page/index.html'),
    protocol: 'file:',
    slashes: true
  }))

  mainWindow.on('closed', function() {
    mainWindow = null;
  });
}

// Create the Application's main menu
let template = [{
  label: "Application",
  submenu: [{
    label: 'Developer Tools',
    accelerator: (function() {
      if (process.platform == 'darwin')
        return 'Alt+Command+I';
      else
        return 'Ctrl+Shift+I';
    })(),
    click: function(item, focusedWindow) {
      if (focusedWindow)
        focusedWindow.toggleDevTools();
    }
  }, {
    label: 'Reload',
    accelerator: 'CmdOrCtrl+R',
    click: function(item, focusedWindow) {
      if (focusedWindow)
        focusedWindow.reload();
    }
  }, {
    type: "separator"
  }, {
    label: 'ver.' + app.getVersion(),
    enabled: false
  }, {
    label: 'Check Update',
    click: function() {
      mainWindow.webContents.send('menu:checkUpdate');
    }
  }, {
    type: "separator"
  }, {
    label: "Quit",
    accelerator: "Command+Q",
    click: function() {
      app.quit();
    }
  }]
}, {
  label: "Edit",
  submenu: [{
    label: "Undo",
    accelerator: "CmdOrCtrl+Z",
    role: "undo"
  }, {
    label: "Redo",
    accelerator: "Shift+CmdOrCtrl+Z",
    role: "redo"
  }, {
    label: "Save",
    accelerator: "CmdOrCtrl+S",
    role: "save",
    click: function() {
      mainWindow.webContents.send('menu:save');
    }
  }, {
    type: "separator"
  }, {
    label: "Cut",
    accelerator: "CmdOrCtrl+X",
    role: "cut"
  }, {
    label: "Copy",
    accelerator: "CmdOrCtrl+C",
    role: "copy"
  }, {
    label: "Paste",
    accelerator: "CmdOrCtrl+V",
    role: "paste"
  }, {
    label: "Select All",
    accelerator: "CmdOrCtrl+A",
    role: "selectAll"
  }]
}];


ipcMain.on('app:title:set', function(event, arg) {
  mainWindow.setTitle(arg);
});

app.on('ready', function() {
  createWindow();
  //注册菜单  
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
});

app.on('window-all-closed', function() {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function() {
  if (mainWindow === null) {
    createWindow();
  }
});