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
                var parse_function = function (){
                    return themes.current_theme.parse.apply(themes.current_theme, arguments);
                }
                req.document = document;
                parser.parse(req, themes.current_theme.header_data, parse_function, function (parsed_header){
                    document.text = parsed_header + document.text;
                    parser.parse(req, themes.current_theme.footer_data, parse_function, function (parsed_footer){
                        document.text += parsed_footer;
                        if(document.code){
                            switch(document.code){
                            case 303:
                                res.setHeader('Location', document.url);
                                res.send(document.code, document.body);
                            break
                            default:
                                callback(document);
                                return
                            break
                            }
                        } else{
                            callback(document);
                        }
                    })
                });
            },
            parse: function (req, capture, parse_callback){
                var document = req.document;
                var self = this;
                var auth_email;
                if(req.session && req.session.auth && req.session.auth.email){
                    auth_email = req.session.auth.email
                }
                var replacement;
                switch(capture){
                    case 'title':
                        if(document && document.title){
                            replacement = document.title;
                        } else{
                            replacement = self.website_title;
                        }
                    break;
                    case 'home_url':
                        replacement = themes.home_url;
                    break;
                    case 'user_bar':
                        if(auth_email){
                            replacement = '<span>Logged in as '+auth_email+'</span>';
                            replacement += '<a id="signout" href="#" class="persona-button orange signout"><span>Sign Out</span></a>';
                        } else{
                            replacement = '<a id="signin" href="#" class="persona-button orange signin"><span>Sign In</span></a>';
                        }
                    break;
                    case "persona":
                        replacement =  '<script>var persona_email = '+(auth_email? ('"'+auth_email+'"') : 'null')+';</script>';
                        replacement += '<script src="rsc/js/persona.js"></script>';
                    break;
                }
                parse_callback(replacement);
            }
        }
        themes.theme_model = theme;
        themes.configure(_configuration, _callback);
        return themes;
    }
    return theme_creator;
})();