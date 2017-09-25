const execa = require("execa");
const Listr = require("Listr");
const path = require("path");
const fs = require("fs-extra");
const home = require("user-home");
const sudo = require("sudo-prompt");
const promisify = require("util").promisify;

module.exports = setup;


function setup(flags) {
  const tasks = new Listr([
    {
      title: "Create ~/.joof",
      skip: () => fileExists(flags.joofDir),
      task: () => createJoofDir(flags)
    },
    {
      title: "Install background service",
      skip: flags.skipService,
      task: () => installService(flags)
    },
    //{
    //  title: "Install self-signed certificate for localhost",
    //  skip: flags.skipCert,
    //  task: (ctx, task) => installCert(flags).catch(err => task.skip())
    //},
    //{
    //  title: "Install Safari extension",
    //  task: () => installSafariExtension()
    //}
  ]);

  return tasks.run();

  function createJoofDir(flags) {
    return fs.outputFile(
      path.join(flags.joofDir, "global.js"), 
      'console.log("%cjoof is ready to go!", "color: green")'
    )
  }

  function installService(flags) {
    const isOSX = /^darwin/.test(process.platform);

    if (isOSX) {
      return installServiceOSX(flags);
    } else {
      return installServiceWin(flags);
    }
  }

  function installServiceWin(flags) {
    var Service = require('node-windows').Service;
    
    // Create a new service object
    var svc = new Service({
      name:'Joof',
      description: 'Joof allows you to add custom JavaScript or CSS to any webpage.',
      script: flags.cliPath,
    });
    
    // Listen for the "install" event, which indicates the
    // process is available as a service.
    svc.on('install',function(){
      svc.start();
    });
    
    svc.install();

  }

  function installServiceOSX(flags) {
    let plist = fs.readFileSync(
      path.join(__dirname, "support", "com.brnbw.joof.plist"),
      "utf-8"
    );

    plist = plist.replace("{NODE_PATH}", flags.nodePath);
    plist = plist.replace("{CLI_PATH}", flags.cliPath);
    plist = plist.replace("{JOOF_DIR}", flags.joofDir);

    const plistDest = path.join(
      home,
      "Library",
      "LaunchAgents",
      "com.brnbw.joof.plist"
    );

    fs.writeFileSync(plistDest, plist, "utf-8");

    return execa("launchctl", ["load", plistDest]);
  }

  function installCert(flags) {
    return new Promise((resolve, reject) => {
      const task = sudo.exec(
        [
          "security add-trusted-cert -d -p ssl -k",
          "/Library/Keychains/System.keychain",
          path.join(__dirname, "support", "self-signed.pem")
        ].join(" "),
        { name: "joof" },
        (err, stdout, stderr) => {
          if (err) reject(err);
          resolve();
        }
      );
    });
  }

  function installSafariExtension () {
    return execa('open', [path.join(__dirname, 'ext', 'joof.safariextz')])
  }
}

function fileExists(path) {
  try {
    fs.accessSync(path);
    return true;
  } catch (err) {
    if (err.code === "ENOENT") return false;
    throw err;
  }
}
