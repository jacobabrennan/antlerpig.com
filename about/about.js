module.exports = (function (){
    var parser = require('../parser.js');
    var file_system = require('fs');var template = {};
    var template;
    file_system.readFile(__dirname+'/about.html', 'utf8', function (error, data){
        if(!error){
            template = data;
        }
    });
    var about = {
        handle: function (req, res, next){
            res._storage = template;
            next();
        }
    }
    return about;
})();