module.exports = (function (){
    var theme_creator = function (_configuration, _callback){
        var file_system = require('fs');
        var parser = require('../parser.js');
        var current_theme = undefined;
        var auth_configuration = {
            'database_name': 'antlerpig',
            'host': 'localhost',
            'user': 'root',
            'password': 'rooty'
        };
        //var auth = require('../auth/auth.js')(auth_configuration);
        var themes = {
            current_theme: current_theme,
			home_url: undefined,
            use_theme: function use_theme(new_theme){
                this.current_theme = new_theme;
                this.current_theme.load();
            },
            configure: function (configuration, callback){
                this.domain = configuration.domain;
				this.home_url = 'http://'+configuration.domain;
            }
        };
        var theme = {
            id: undefined, // Unique lowercase alpha_numeric String.
            name: "theme",
            ready: false,
            website_title: 'core',
            load: function (){
                var theme = this;
                var success = true;
                var header_url = __dirname + "/" + this.name + "/header.html"
                file_system.readFile(header_url, "utf8", function (error, data){
                    if(!error){
                        theme.header_data = data;
                    } else{
                        success = false;
                    }
                });
                var footer_url = __dirname + "/" + this.name + "/footer.html"
                file_system.readFile(footer_url, "utf8", function (error, data){
                    if(!error){
                        theme.footer_data = data;
                    } else{
                        success = false;
                    }
                });
                if(success){
                    this.ready = true;
                }
            },
            document: function (req, res, next){
                var document = res._storage;
                if(typeof document === "string"){
                    document = {
                        text: res._storage,
                        title: this.website_title
                    };
                }
                if(!themes.current_theme.ready){
                    res._storage = 500;
                    next();
                    return;
                }
                if(res._error){
                    document.text = '<div class="http_error"><span class="error_code">Error '+res._error+'</h1></div>';
                }
                var theme = this;
                var callback = function (doc){
                    res._storage = doc.text;
                    next();
                }
                themes.current_theme.header(req, document, function (){
                    themes.current_theme.footer(req, document, function (){
                        callback(document);
                    });
                });
            },
            header: function (req, document, callback){
				var self = this;
                var auth_email
                if(req.session && req.session.auth && req.session.auth.email){
                    auth_email = req.session.auth.email
                }
                var replacer = function (capture, parse_callback){
                    var replacement;
                    switch(capture){
                        case 'title': {
                            if(document && document.title){
                                replacement = document.title;
                            } else{
                                replacement = self.website_title;
                            }
                            break;
                        }
						case 'home_url': {
							replacement = themes.home_url;
							break;
						}
                        case 'user_bar': {
                            if(auth_email){
								replacement = '<span>Logged in as '+req.session.auth.email+'</span>';
								replacement += '<a id="signout" href="#" class="persona-button orange"><span>Sign Out</span></a>';
                            } else{
								replacement = '<a id="signin" href="#" class="persona-button orange"><span>Sign In</span></a>';
                            }
                            parse_callback(replacement)
                            return;
                        }
                    }
                    parse_callback(replacement);
                };
                parser.parse(this.header_data, replacer, function (parsed_header){
                    document.text = parsed_header + document.text;
                    callback();
                });
            },
            footer: function (req, document, callback){
                var auth_email = null;
                if(req.session && req.session.auth && req.session.auth.email){
                    auth_email = req.session.auth.email
                }
                var replacer = function (capture, parse_callback){
                    var replacement;
                    switch(capture){
                        case "title": {
                            break;
                        }
                        case "persona": {
                            replacement = '<script>var persona_email = '+(auth_email? ('"'+auth_email+'"') : 'null')+';</script>';
                            break;
                        }
                        case 'user_bar': {
                            if(req.session && req.session.auth && req.session.auth.email){
								replacement = '';
								if(req.session.auth.email){
									replacement += '<span>Logged in as '+req.session.auth.email+'</span>';
								}
								replacement += '<a id="signout" href="#" class="persona-button orange"><span>Sign Out</span></a>';
                                //replacement = 'Logged in as '+'TODO:'+'. <a href="https://'+themes.domain+'/logout">Logout</a>';
                            } else{
								replacement = '<a id="signin" href="#" class="persona-button orange"><span>Sign In</span></a>';
                                //replacement = '<a href="https://'+themes.domain+'/login">Login</a>';
                            }
                            break;
                        }
                    }
                    parse_callback(replacement);
                };
                parser.parse(this.footer_data, replacer, function(parsed_footer){
                    document.text = document.text + parsed_footer;
                    callback();
                });
            }
        }
        themes.theme_model = theme;
        themes.configure(_configuration, _callback);
        return themes;
    }
    return theme_creator;
})();