var fs = require('fs');
var path = require('path');
var babel = require('babel-core');
var UglifyJS = require("uglify-js");
var beautify = require('js-beautify').js_beautify;

var importRegex = /import\s*?([^\s]*?)\s*?from\s*?['"]([^;]*?)['"]\s*?;/;
function processFile (fileName, variableName) {
    var fileContents = [];
    var importedFiles = [];

    function processThisFile (fileName, variableName) {
        var fileContent = fs.readFileSync(path.join(__dirname, 'src/' + fileName + '.js'), 'utf8');
        var importMatch;

        while (importMatch = fileContent.match(importRegex)) {
            if(importedFiles.indexOf(importMatch[2]) === -1) processThisFile(importMatch[2], importMatch[1]);
            fileContent = fileContent.replace(importMatch[0], '');
        }

        fileContents.push('const ' + (variableName || fileName) + ' = (function () {' + fileContent.trim() + ' return ' + fileName + ';})();');
        importedFiles.push(fileName);
    }
    processThisFile(fileName, variableName);

    var transformedCode = babel.transform(fileContents.join('/*<<<>>>*/'), {
        presets: ["env"],
        plugins:[
            [ "babel-plugin-transform-helper", {
                    helperFilename: 'dist/helpers.js'
                }
            ]
        ]
    });
    transformedCode = transformedCode.code.split('/*<<<>>>*/').join('\n\n');
    transformedCode = transformedCode.replace(/require\(\'\.\/dist\/helpers\.js\'\)/g, 'BabelHelpers');
    transformedCode = transformedCode.replace(/['"]use strict['"];/g, '');

    var helperPath = path.join(__dirname, 'dist/helpers.js');
    var helpersCode = 'var BabelHelpers = {};\n' + fs.readFileSync(helperPath, 'utf8').replace(/exports/g, 'BabelHelpers');
    fs.unlinkSync(helperPath);

    return helpersCode + transformedCode;
}

var mainFile = 'AutoSuggest';
var prefix = '\
(function (root, factory) {\
    if (typeof define === "function" && define.amd) {\
        define("AutoSuggest", ["jquery"], factory);\
    } else if (typeof module === "object" && module.exports) {\
        module.exports = factory(require("jquery"));\
    } else {\
        root.AutoSuggest = factory(root.jQuery || root.$);\
    }\
}(this, function($) {\
    if (!$) {\
        throw new Error("AutoSuggest: dependencies not met - jQuery is not defined");\
    }\n\n';
var postfix = '\n\nreturn AutoSuggest; }));';
var beautifyOptions = {
    indent_size: 4
};

var code = prefix + processFile(mainFile) + postfix;
code = beautify(code, beautifyOptions);
fs.writeFileSync(path.join(__dirname, 'dist/autosuggest.js'), code);
code = UglifyJS.minify(code);
console.error(code.error || 'No Errors Found');
fs.writeFileSync(path.join(__dirname, 'dist/autosuggest.min.js'), code.code);
