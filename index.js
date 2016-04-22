#!/usr/bin/env node

/**
 * See the printHelp function for details on what this package
 * is doing.
 */

var npm = require('npm');
var fs = require('fs');
var path = require('path');
var rimraf = require('rimraf');
var _string = require('underscore.string');
var syncLog = {};

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
        // Maybe the user provided a path to the package being linked (instead of it's name).
        packageLinkDir = path.resolve(process.cwd(), packageName);
        if (fs.existsSync(packageLinkDir)) {
            // Yep ... user provided a relative path. So, we need to discover the package name.
            var linkedPackageJSONFile = packageLinkDir + '/package.json';
            if (fs.existsSync(linkedPackageJSONFile)) {
                var linkedPackageJSON = require(linkedPackageJSONFile);
                packageName = linkedPackageJSON.name;
            } else {
                error("*** '" + packageLinkDir + "' is not an NPM package (has no package.json).");
                return;
            }
        } else {
            error("*** Package '" + packageName + "' has not yet been globally linked. You must go there and link it first.");
            return;
        }
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

    var linkedPackageJSON = require(packageLinkDir + '/package.json');
    
    // Watch all files (but the node_modules) in the linked package, copying changes
    // as they happen.
    watchAll(packageLinkDir, packageLocalNMDir, linkedPackageJSON.files, false);
    console.log('Watching for changes in ' + packageLinkDir);
    
    // Create the marker file.
    fs.writeFileSync(slinkMarkerFile, '');
});

function watchAll(packageLinkDir, packageLocalNMDir, filesSpec, tellTheUser) {
    var targetDir = path.resolve(packageLinkDir, 'target');
    walkDirTree(packageLinkDir, function(dir) {
        if (_string.endsWith(dir, 'node_modules') || dir === targetDir) {
            // Do not go down into the node_modules or target dirs
            return false;
        }
        
        var relativeToPackageRoot = './' + path.relative(packageLinkDir, dir);
        if (relativeToPackageRoot !== './') {
            relativeToPackageRoot += '/';
        } 
        
        var linkFiles = fs.readdirSync(dir);
        if (linkFiles) {
            for (var i = 0; i < linkFiles.length; i++) {
                var linkFile = linkFiles[i];
                
                if (linkFile === 'node_modules') {
                    continue;
                }
                
                var linkFilePath = path.resolve(dir, linkFile);
                
                if (linkFile === 'target' || isInDirectory(linkFilePath, targetDir)) {
                    // Ignore anything in the target dir.
                    continue;
                }
                
                var localFilePath = path.resolve(path.resolve(packageLocalNMDir, relativeToPackageRoot), linkFile);
                var linkFileStat = fs.statSync(linkFilePath);
                var localFileStat = undefined;
                
                if (linkFileStat.mtime.getTime() === syncLog[linkFilePath]) {
                    continue;
                }
                syncLog[linkFilePath] = linkFileStat.mtime.getTime();
                
                if (linkFileStat.isDirectory()) {
                    // Make sure this directory exists in the local node_modules path.
                    if (!fs.existsSync(localFilePath) && isFileOfInterest(linkFilePath, packageLinkDir, filesSpec)) {
                        fs.mkdirSync(localFilePath);
                    }
                    // Other than that, ignore dirs ... walkDirTree will walk us down.
                    continue;
                }
                
                if (fs.existsSync(localFilePath)) {
                    localFileStat = fs.statSync(localFilePath);
                }
                
                // If the file in the link dir is newer than the local file
                if (localFileStat === undefined || linkFileStat.mtime.getTime() > localFileStat.mtime.getTime()) {
                    if (linkFile !== 'package.json') {
                        // See https://github.com/tfennelly/slink/issues/1
                        if (!isFileOfInterest(linkFilePath, packageLinkDir, filesSpec)) {
                            if (tellTheUser) {
                                console.log('    ' + relativeToPackageRoot + linkFile + ' changed but is outside package.json:files. Ignoring change.');
                            }
                            continue;
                        }
                        if (tellTheUser) {
                            console.log('    ' + relativeToPackageRoot + linkFile + ' changes synchronized.');
                        }

                        // If the same file exists in the locally installed
                        // package, then we delete that.
                        if (fs.existsSync(localFilePath)) {
                            fs.unlinkSync(localFilePath);
                        }

                        // Copy the file. Symlinking does not work because require resolve
                        // the performs resolution relative to the symlink real path, which
                        // screws things up in lots of cases.
                        fs.writeFileSync(localFilePath, fs.readFileSync(linkFilePath));
                    } else {
                        console.log('*** Looks like the package.json file in the linked package has changed. Please reinstall and reslink.');
                        process.exit(0);
                    }
                }
            }
        }
    });
    
    setTimeout(function() {
        watchAll(packageLinkDir, packageLocalNMDir, filesSpec, true);
    }, 1000);
}

function isFileOfInterest(linkFilePath, packageLinkDir, filesSpec) {
    if (!filesSpec) {
        return true;
    }

    for (var i = 0; i < filesSpec.length; i++) {
        var fileSpec = path.resolve(packageLinkDir, filesSpec[i]);

        if (!fs.existsSync(fileSpec)) {
            continue;
        }

        var fileSpecStat = fs.statSync(fileSpec);
        if (fileSpecStat.isDirectory() && isInDirectory(linkFilePath, fileSpec)) {
            return true;
        } else if (linkFilePath === fileSpec) {
            return true;
        }
    }

    return false;
}

function isInDirectory(filePath, dir) {
    var parentDir = path.dirname(filePath);
    
    if (parentDir === dir) {
        return true;
    } else if (parentDir === filePath) {
        // we've reached the root dir
        return false;
    } else {
        return isInDirectory(parentDir, dir);
    }
}

function error(message) {
    console.log(message);
    process.exit(1);
}

function printHelp() {
    console.log("------------------------------------------------------");
    console.log("");
    console.log("slink is a source only 'link' i.e. it does");
    console.log("not link the node_modules dir, which means that the");
    console.log("linked package will have a properly flattened");
    console.log("and deduped node-modules dir wrt the package");
    console.log("being linked into.");
    console.log("");
    console.log("Goto https://www.npmjs.com/package/slink for usage");
    console.log("details.");
    console.log("------------------------------------------------------");
}

function walkDirTree(startDir, callback) {
    if (!fs.existsSync(startDir)) {
        return;
    }
    var stats = fs.statSync(startDir);
    if (!stats.isDirectory()) {
        return;
    }
    
    if (callback(startDir) !== false) { // Stop recursion if the callback returns false.
        var files = fs.readdirSync(startDir);
        if (files) {
            for (var i = 0; i < files.length; i++) {
                // Recursively call walkDirTree for each.
                // It will ignore non-directory files.
                walkDirTree(path.resolve(startDir, files[i]), callback);
            }
        }
    }
}