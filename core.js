module.exports = (function (){
    var parser = require('./parser.js');
    var util = require('util');
    var file_system = require('fs');
    var express = require('express');
    var connect_mysql_session = require('connect-mysql-session');
	var request = require('request');
	var socketio = require('socket.io');
    var mime = require('express/node_modules/send/node_modules/mime');
    mime.define({
        'video/webm': ['webm'],
        'video/ogv': ['ogv'],
        'video/mp4': ['mp4']
    });
    var core = function (configuration){
        var port = configuration.port || 80;
        var database_configuration = {
            'database_name': configuration.database_name,
            'host': configuration.database_host,
            'user': configuration.database_user,
            'password': configuration.database_password
        };
        var theme_configuration = {
            'website_title': configuration.website_title,
            'theme_name': configuration.theme_name,
			'domain': configuration.domain
        };
        var blog_configuration = {
            'website_title': configuration.website_title,
            'domain': configuration.domain,
            'owner': configuration.owner
        };
        var server = express();
        var database = require('./database/database.js')(database_configuration);
        blog_configuration.database_access_context = database;
        server.blog = require('./blog/blog.js')(blog_configuration);
        var themes = require('./themes/themes.js')(theme_configuration);
        themes.use_theme(Object.create(themes.theme_model, {
            name: {value: theme_configuration.theme_name},
            website_title: {value: theme_configuration.website_title}
        }));
        var about = require('./about/about.js');
		var fennel = require('./fennel/fennel.js');
        database.setup(database_configuration, function (){});
        //server.listen(port);
		var http_server = require('http').createServer(server);
		http_server.listen(port);
		var io = socketio.listen(http_server, { log: true });
        var ender = function(req, res, next){
            if(res._error){
                res.send(res._error, res._storage);
            } else{
                res.send(res._storage)
            }
        }
        server.configure(function (){
			// Fav Icon and static files
            server.use(express.favicon(__dirname + '/public/rsc/sample.ico'));
            server.use('/rsc', express.static(__dirname + '/public/rsc'));
			// Add core system to all non-static files
            server.use(function (req, res, next){
                req.core = server;
                next();
            });
			// Parse POST data and cookies
			server.use(express.bodyParser());
            server.use(express.cookieParser());
			// Create easy to access session object on request
            var MySQLSessionStore_constructor = connect_mysql_session(express);
            server.store = new MySQLSessionStore_constructor(
                configuration.database_name,
                configuration.database_user,
                configuration.database_password,
                {}
            );
            var session_config = {
                'secret': 'something',
                'store': server.store
            };
            server.use(express.session(session_config));
			// Log Crap. Why not?
            //server.use(express.logger('dev'));
			// Temporary stuff to server up instruction_lab demo vids.
            server.use('/rsc/instruction_lab/Vids', function(req, res, next){
                res.setHeader('Content-Type', mime.lookup(req.path));
                res.sendfile(__dirname + '/public/rsc/instruction_lab/Vids'+req.path);
            });
			// Login/out, factor this out
			server.use('/persona/login', function (req, res, next){
				var body = JSON.stringify({
					assertion: req.body.assertion,
					audience: 'http://'+configuration.domain+':'+configuration.port
				});
				var options = {
					url: 'https://verifier.login.persona.org/verify',
					body: body,
					headers: {
						"Content-Type": "application/json"
					},
					method: 'POST'
				};
				request(options, function (err, resp, res_body) {
					var respJSON = JSON.parse(res_body);
					req.session.auth = {email: respJSON.email};
					req.session.save();
					res.send(res_body);
				});
			});
			server.use('/persona/logout', function (req, res, next){
				req.session.auth = {};
				res.send({message: 'Logged Out'});
			});
			server.use('/persona', ender);
			// Yay! Actual content handling!
            var dont_know_what_to_call_this = function (sub_path, sub_app){
                server.use('/'+sub_path, function (req, res, next){
                    sub_app.handle(req, res, next);
                })
                server.use('/'+sub_path, function (req, res, next){
                    themes.current_theme.document(req, res, next);
                });
                server.use('/'+sub_path, ender);
            }
            dont_know_what_to_call_this('blog', this.blog);
            dont_know_what_to_call_this('about', about);
            dont_know_what_to_call_this('fennel', fennel);
            dont_know_what_to_call_this('', this.blog);
        });
        console.log('Core Server Listening on Port '+port);
        return server;
    }
    return core;
})();