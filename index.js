#!/usr/bin/env node

/**
 * See the printHelp function for details on what this package
 * is doing.
 */

var npm = require('npm');
var fs = require('fs');
var path = require('path');

npm.load(function() {
    var gPrefix = npm.config.get('prefix');
    var gNodeModules = gPrefix + '/lib/node_modules';
    
    if (process.argv.length !== 3) {
        error("*** You must supply package name to be slink'd. (-h for help)");
        return;
    }
    
    if (process.argv[2] === '-h' || process.argv[2] === '-help') {
        printHelp();
        return;
    }
    
    var packageName = process.argv[2];
    var packageLinkDir = path.resolve(gNodeModules, packageName);
    if (!fs.existsSync(packageLinkDir)) {
        error("*** Package '" + packageName + "' has not yet been globally linked. You must go there and link it first.");
        return;
    }
    var lstatLinkDir = fs.lstatSync(packageLinkDir);
    if (lstatLinkDir.isSymbolicLink()) {
        packageLinkDir = fs.readlinkSync(packageLinkDir);
    }
    
    var packageLocalNMDir = path.resolve(process.cwd(), 'node_modules/' + packageName);
    if (!fs.existsSync(packageLocalNMDir)) {
        error("*** Package '" + packageName + "' has not yet been installed in this package/project.");
        return;
    }
    var slinkMarkerFile = path.resolve(packageLocalNMDir, '.slink');
    if (fs.existsSync(slinkMarkerFile)) {
        error("*** Package '" + packageName + "' has already been slink'd. You must reinstall it if you wish to reslink it (npm install).");
        return;
    }

    // Now, we remove everything from packageLocalNMDir that exists in the packageLinkDir
    // and then symlink from the packageLinkDir. Ignores the node_module dir and package.json.
    // 
    // In the end, we end up with a linked version of the package being developed, but
    // also having a properly flattened/deduped node_module dir wrt the package it is
    // linked into, which means we don't need to do other linking that in many cases
    // probably will not work anyway.
    
    // Link all files (but the node_modules) from the linked package to
    // the local install.
    linkAll(packageLinkDir, packageLocalNMDir);
    
    // Create the marker file.
    fs.writeFileSync(slinkMarkerFile, '');
});

function linkAll(packageLinkDir, packageLocalNMDir) {
    var files = fs.readdirSync(packageLinkDir);
    if (files) {
        var rimraf = require('rimraf');

        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            
            if (file === 'node_modules' || file === 'package.json') {
                continue;
            }
            
            // If the same file exists in the locally installed
            // package, then we delete that and symlink the file
            // from the link dir.
            var localFilePath = path.resolve(packageLocalNMDir, file);
            if (fs.existsSync(localFilePath)) {
                var stats = fs.statSync(localFilePath);
                if (stats.isDirectory()) {
                    rimraf.sync(localFilePath);
                } else {
                    fs.unlinkSync(localFilePath);
                }
                
                var linkFilePath = path.resolve(packageLinkDir, file);
                fs.symlinkSync(linkFilePath, localFilePath);
            }
        }
    }
}

function error(message) {
    console.log(message);
    process.exit(1);
}

function printHelp() {
    console.log("------------------------------------------------------");
    console.log("slink is a source only 'link' i.e. it does");
    console.log("not link the node_modules dir, which means that the");
    console.log("linked package will have a properly flattened");
    console.log("and deduped node-modules dir wrt the package");
    console.log("being linked into.");
    console.log("");
    console.log("Step 1:");
    console.log("-------");
    console.log("If you are linking, then you are developing a");
    console.log("package. You need to create a global link for");
    console.log("this package, allowing it to be easily linked");
    console.log("into other packages (steps 2 and 3). You may");
    console.log("already have this done, so skip this step if");
    console.log("you have.");
    console.log("");
    console.log("From inside the package being developed e.g.");
    console.log("the 'my-cool-package' package in the 'dev' folder:");
    console.log("");
    console.log("    npm link");
    console.log("");
    console.log("Step 2:");
    console.log("-------");
    console.log("You need to 'npm install' the package being");
    console.log("developed (see step 1) into the package in which");
    console.log("you want to test it.");
    console.log("");
    console.log("From inside the package being used for testing:");
    console.log("");
    console.log("    npm install ../../dev/my-cool-package");
    console.log("");
    console.log("This installs 'my-cool-package' properly, flattening,");
    console.log("deduping etc.");
    console.log("");
    console.log("Step 3:");
    console.log("-------");
    console.log("Now we're ready to slink:");
    console.log("");
    console.log("From inside the package being used for testing");
    console.log("(same folder as step 2):");
    console.log("");
    console.log("    slink my-cool-package");
    console.log("------------------------------------------------------");
}
