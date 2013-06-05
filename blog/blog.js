module.exports = (function (){
    var encoder = new (require('node-html-encoder').Encoder)('entity');
        // The above has to be the worst way to make a node module. The below may work.
        // var encoder = require('node-html-encoder');
    var parser = require('../parser.js');
    var file_system = require('fs');
    var query_string = require('querystring');
    var for_async = require('../for_async.js');
    var template = {};
    file_system.readFile(__dirname+"/post.html", "utf8", function (error, data){
        if(!error){
            template.post = data;
        }
    });
    file_system.readFile(__dirname+"/comment_section.html", 'utf8', function (error, data){
        if(!error){
            template.comment_section = data;
        }
    });
    file_system.readFile(__dirname+"/comment.html", 'utf8', function (error, data){
        if(!error){
            template.comment = data;
        }
    });
    blog_creator = function (_configuration, _callback){
        /*Object.defineProperty(global, '__stack', {
          get: function(){
            var orig = Error.prepareStackTrace;
            Error.prepareStackTrace = function(_, stack){ return stack; };
            var err = new Error;
            Error.captureStackTrace(err, arguments.callee);
            var stack = err.stack;
            Error.prepareStackTrace = orig;
            return stack;
          }
        });
        Object.defineProperty(global, '__line', {
          get: function(){
            return __stack[1].getLineNumber();
          }
        });*/
        var blog = {
            website_title: 'core',
            domain: 'localhost',
            database: undefined,
            configure: function (configuration, callback){
                this.website_title = configuration.website_title || this.website_title;
                this.domain = configuration.domain || this.domain;
                this.database = configuration.database_access_context;
                if(callback){ callback();}
            },
            handle: function (req, res, next){
                this.page(req, res, function (content){
                    res._storage = content;
                    next();
                });
            },
            page: function(req, res, callback){
				var self = this;
                var auth_email
                if(req.session && req.session.auth && req.session.auth.email){
                    auth_email = req.session.auth.email
                }
                var document = {
                    title: this.website_title,
                    text: ''
                }
                var path = req.path.toLowerCase();
                if(path === "/"){
                    document.text = '';
                    blog.retrieve_posts(req.query, function (error, result){
                        var result_length = (result? result.length : 0);
                        if(result_length == 0){
                            document.text = 'There are no posts to display.';
                            callback(document);
                            return;
                        }
                        var result_text = '';
                        var result_body = function (init, for_callback){
                            var indexed_post = result[init.index];
                            var show_comments = false;
                            if(result_length == 1){
                                show_comments = true;
                            }
                            blog.display_post(req, indexed_post, show_comments, function (post_text){
                                result_text += post_text;
                                for_callback();
                            })
                        };
                        for_async({index: 0}, function (init){ return (init.index < result_length)}, function (init){ init.index++}, result_body, function (){
                            document.text += result_text;
                            var skip_amount = result._skip || 0;
                            if(skip_amount || result._count > 5){
                                document.text += '<nav class="pagination">';
                                if(skip_amount){
                                    document.text += '<a class="newer" href="/blog?skip='+Math.max(0, skip_amount-5)+'">Newer</a>';
                                }
                                if(result._count > skip_amount+5){
                                    document.text += '<a class="older" href="/blog?skip='+Math.min(result._count-1, skip_amount+5)+'">Older</a>';
                                }
                                document.text += '</nav>';
                            }
                            callback(document);
                        });
                    });
                } else if(path === '/add'){
                    var post_creation_form = function (post_info, form_callback){
                        file_system.readFile(__dirname+'/new_post.html', "utf8", function (error, data){
                            if(!error){
                                var form_replacer = function (){
									return self.parse_post.apply(post_info, arguments);
                                };
                                parser.parse(req, data, form_replacer, function (parsed_form){
                                    form_callback(parsed_form);
                                });
                            } else{
                                form_callback(error);
                            }
                        });
                    };
                    if(req.method.toLowerCase() === 'get'){
						if((!auth_email) || (auth_email != _configuration.owner)){
							document.text = 'You do not permission to access this feature.'
							callback(document);
							return;
						}
                        var post_id = req.query.post;
                        if(post_id){
                            this.database.retrieve('posts', {id: post_id}, function(error, data){
                                if(error || !data.length){
                                    document.text = 'An error occured while retrieving the specified post.';
                                    callback(document);
                                    return;
                                } else{
                                    post_creation_form(data[0], function (form_html){
                                        document.text = form_html;
                                        callback(document);
                                    })
                                }
                            });
                        }
                        else{
                            post_creation_form(null, function (form_html){
                                document.text = form_html;
                                callback(document);
                            });
                        }
                    } else if(req.method.toLowerCase() === 'post'){
						if((!auth_email) || (auth_email != _configuration.owner)){
							document.text = 'You do not permission to access this feature.'
							callback(document);
							return;
						}
                        var post = req.body;
                        if(post.preview == 1){
                            post.created = new Date();
                            blog.display_post(req, post, false, function(post_result){
                                post_creation_form(post, function (form_html){
                                    document.text = post_result + form_html;
                                    callback(document);
                                });
                            })
                        } else if(post.delete == 1){
                            blog.delete_post(post, function(error, result){
                                if(!error){ document.text = 'The post was deleted.';}
                                else { document.text = 'There was an error. Try again later.';}
                                callback(document);
                            });
                        } else{
                            blog.create_post(post, function(){
                                var redirect_href = "/blog?post="+post.id;
                                document.text = '<h1>Posted</h1><div class="post_message">Your message has been posted. <a href="'+redirect_href+'">Click here to continue</a></div>';
                                callback(document);
                            });
                        }
                    } else{
                        document.text = 417;
                        // TODO: Handle other methods, return actual error codes.
                        callback(document);
                    }
                } else if(path === "/new_comment"){
                    if(req.method.toLowerCase() === "get"){
                        file_system.readFile(__dirname+"/new_post.html", "utf8", function (error, data){
                            if(!error){
                                document.text = data;
                            } else{
                                document.text = error;
                            }
                            callback(document);
                        });
                    } else if(req.method.toLowerCase() === "post"){
						var comment = req.body;
						if(auth_email && comment.post_id && comment.body){
							comment.author = auth_email;
							blog.add_comment(comment, function(){
								var redirect_href = "/blog?post="+comment.post_id;
								document.text = '<h1>Posted</h1><div class="post_message">Your message has been posted. <a href="'+redirect_href+'">Click here to continue</a></div>';
								callback(document);
							});
						} else{
							var redirect_href = "/blog";
							document.text = '<h1>Error: 403</h1><div class="post_message">Sign in to post a comment. <a href="'+redirect_href+'">Click here to continue</a></div>'
							callback(document);
						}
                    } else{
                        document.text = 417;
                        // TODO: Handle other methods, return actual error codes.
                        callback(document);
                    }
                }/* else if(path == "/register"){
                    document.text += '<h1>Register</h1>'
                    document.text += '<form name="register" action="register" method="post"><br/>';
                    document.text += 'Username: <input type="text" name="username" maxlength="30" /><br/>';
                    document.text += 'Password: <input type="password" name="pass1" /><br/>';
                    document.text += 'Password Again: <input type="password" name="pass2" /><br/>';
                    document.text += '<input type="submit" value="Register" /><br/>';
                    document.text += '</form>';
                    callback(document);
                }*/ else if(path == "/moderate"){
                    if(auth_email == _configuration.owner){
                        if(req.method.toLowerCase() === "post"){
                            switch(req.body.action){
                                case 'comment_delete':{
                                    blog.delete_comment({'id': req.body.comment_id}, function (){});
                                    res.setHeader('Location', '/blog?post='+req.body.post_id);
                                    res.send(303, 'Logged in. Redirecting to main site.');
                                }
                            }
                        }
                    }
                }
                else{
                    callback(document);
                }
            },
            parse_post: function (req, capture, callback){
                // this == a post object
                var post = this;
				if(!post){
					callback('');
					return;
				}
                var auth_email
                if(req.session && req.session.auth && req.session.auth.email){
                    auth_email = req.session.auth.email
                }
                var replacement;
                switch(capture){
                    case 'id':
                        replacement = post.id || '';
                    break;
                    case 'title':
                        replacement = post.title || '';
                    break;
                    case 'body':
                        replacement = post.body || ''; 
                    break;
                    case 'url':
                        if(post.id){
                            replacement = '/blog?post='+post.id;
                        } else{
                            replacement = '#';
                        }
                    break;
					case 'delete':
						if(post.id){
							replacement = '<button name="delete_button" type="button">Delete</button>';
						} else{
							replacement = '';
						}
					break;
                    case 'edit_controls':
                        if(_configuration.owner && auth_email == _configuration.owner){
                            replacement =  '<div class="edit_controls">';
                            replacement += '<a href="add?post='+post.id+'">Edit</a>';
                            replacement += '</div>';
                        } else{
                            replacement = '';
                        }
                    break;
                    case 'created':
                        var pdate = post.created;
                        if(!pdate){
                            replacement = '';
                            break;
                        }
                        var phour = pdate.getHours();
                        var p_postfix = 'AM';
                        if(phour >= 12){
                            p_postfix = 'PM';
                            if(phour > 12){
                                phour -= 12;
                            }
                        } else if(phour == 0){
                            phour = 12;
                        }
                        var slug_string = pdate.toLocaleDateString()+' at '+phour+':'+pdate.getMinutes()+p_postfix;
                        replacement = slug_string;
                    break;
                    case 'comment_number':
                        if(!post.id){
                            replacement = 'No Comments To Display';
                        } else{
                            req.core.blog.database.count('comments', {id: post.id}, function (error, comment_count){
                                if(error){
                                    callback('No Comments To Display');
                                } else{
                                    var number_text = comment_count.toString()+' comment';
                                    if(comment_count != 1){
                                        number_text += 's';
                                    }
                                    callback(number_text);
                                }
                            });
                            return;
                        }
                    break;
                    case "comment_section":
                        // TODO: Refactor this whole mess so as to use one global parse, like a PHP substitute.
                        if(post.show_comments){
                            req.core.blog.display_comments(req, post, callback)
                            return;
                        } else{
                            replacement = '';
                        }
                    break;
                    case "facebook_share":
                        var share_url = "http://www.facebook.com/sharer.php?"
                        share_url += "s=100&p[title]="+encodeURIComponent(post.title);
                        share_url += '&p[url]=http://'+blog.domain+'/blog?id='+post.id;
                        replacement = share_url;
                    break;
                    default:
                        replacement = undefined;
                    break;
                }
                callback(replacement);
            },
            parse_comments: function (req, capture, callback){
                // this == a post object.
                var post = this;
                var auth_email
                if(req.session && req.session.auth && req.session.auth.email){
                    auth_email = req.session.auth.email;
                }
                switch(capture){
                    case 'id':
                        replacement = post.id;
                    break;
                    case 'comments':
                        var comments_query = {post_id: post.id}
                        req.core.blog.retrieve_comments(comments_query, function (error, result){
                            if(!result){
                                replacement = ''; // Not undefined; This is not an error, but an empty set of comments;
                                callback(replacement);
                                return;
                            }
                            var comments_text = ''
                            var for_body = function (init, for_callback){
                                var indexed_comment = result[init.index];
                                blog.display_comment(req, post, indexed_comment, function (single_comment_text){
                                    comments_text += single_comment_text;
                                    for_callback();
                                });
                            };
                            for_async({index: 0}, function (init){ return init.index < result.length}, function (init){ init.index++}, for_body, function (){
                                callback(comments_text);
                            });
                        });
                        return;
                    break;
					case 'auth':
						if(auth_email){
							replacement = '';
						} else{
							replacement = ' style="display:none;"';
						}
					break;
					case 'no_auth':
						if(auth_email){
							replacement = ' style="display:none;"';
						} else{
							replacement = '';
						}
					break;
                    default:
                        replacement = '';
                    break;
                }
                callback(replacement);
            },
            parse_comment: function (req, capture, callback){
                // this == a comment object;
                var comment = this;
                var post = comment.post;
                var auth_email;
                if(req.session && req.session.auth && req.session.auth.email){
                    auth_email = req.session.auth.email;
                }
                var replacement;
                switch(capture){
                    case "author":
                        replacement = comment.author;
                        //self.database.retrieve("users", "users", {id: indexed_again.author_id}, function (error, data){
                        //    var c_first_user = data[0]; // There should only be one user with an id in the database.
                        //    again_callback(c_first_user.name);
                        //})
                        //return;
                    break;
                    case "created":
                        // TODO: Time displays incorrectly.
                        var cdate = post.created;
                        var chour = cdate.getHours();
                        var c_postfix = "AM";
                        if(chour >= 12){
                            c_postfix = "PM";
                            if(chour > 12){
                                chour -= 12;
                            }
                        } else if(chour == 0){
                            chour = 12;
                        }
                        var c_slug_string = cdate.toLocaleDateString();//+" at "+chour+":"+cdate.getMinutes()+c_postfix;
                        replacement = c_slug_string;
                    break;
                    case 'edit_controls':
                        if(_configuration.owner && auth_email == _configuration.owner){
                            replacement =  '<div class="edit_controls">';
                            replacement += '<form action="moderate" method="post">';
                            replacement += '<input type="hidden" name="action" value="comment_delete" />';
                            replacement += '<input type="hidden" name="post_id" value="'+post.id+'" />';
                            replacement += '<input type="hidden" name="comment_id" value="'+comment.id+'" />';
                            replacement += '<button type="submit">Delete</button>';
                            replacement += '</form>';
                            replacement += '</div>';
                        } else{
                            replacement = '';
                        }
                    break;
                    case "body":
                        replacement = comment.body;
                    break;
                    default:
                        replacement = undefined;
                    break;
                }
                callback(replacement);
            },
            display_post: function(req, post, show_comments, callback){
                var self = this;
                if(show_comments){
                    post.show_comments = true;
                }
                var replacer = function (){
                    return self.parse_post.apply(post, arguments);
                };
                parser.parse(req, template.post, replacer, function (parsed_post){
                    callback(parsed_post);
                });
            },
            display_comments: function (req, post, callback){
                var self = this;
                var replacer = function (){
                    return self.parse_comments.apply(post, arguments);
                }
                parser.parse(req, template.comment_section, replacer, function (parsed_section){
                    callback(parsed_section);
                });
            },
            display_comment: function (req, post, comment, callback){
                var self = this;
                comment.post = post;
                var replacer = function (){
                    return self.parse_comment.apply(comment, arguments);
                }
                parser.parse(req, template.comment, replacer, function (parsed_comment){
                    callback(parsed_comment);
                });
            },
            create_post: function (post, callback){
                var keys = ['title', 'body'];
                var values = [post.title, post.body];
                if(post.id){
                    keys.push('id');
                    values.push(post.id);
                    this.database.update('posts', keys, values, function (error, data){
                        callback(error, data);
                    });
                } else{
                    this.database.insert("posts", keys, values, callback);
                }
            },
            add_comment: function (comment, callback){
                var keys = ['author', 'post_id', 'body'];
                if(!comment.post_id){
					console.log('==================================\nNo post_id')
                    callback();
                    return;
                };
                var values = [
                    comment.author,
                    parseInt(comment.post_id),
                    encoder.htmlEncode(comment.body)
                ];
				console.log('======================================\nInserting');
                this.database.insert("comments", keys, values, callback);
            },
            delete_post: function (post, callback){
                this.database.delete_row('posts', parseInt(post.id), callback);
                // TODO: Delete associated comments.
            },
            delete_comment: function (comment, callback){
                this.database.delete_row('comments', parseInt(comment.id), callback);
            },
            retrieve_posts: function (query, callback){
                // TODO: Date ranges, number, etc
                // Matches keyword.
                // By Time
                // Most recent
                var parameters = {};
                if(query.post){
                    var post_id = parseInt(query.post, 10);
                    if(post_id){
                        parameters.id = post_id;
                    }
                } else{
                    if(query.skip){
                        parameters.skip = Math.max(0, query.skip);
                    }
                }
                this.database.retrieve("posts", parameters, callback);
            },
            retrieve_comments: function (query, callback){
                var parameters = {limit: 50};
                if(query.post_id){
                    var post_id = parseInt(query.post_id, 10);
                    if(post_id){
                        parameters.post_id = post_id;
                    }
                }
                this.database.retrieve("comments", parameters, callback);
            }
        };
        blog.configure(_configuration, _callback);
        return blog;
    };
    return blog_creator;
})();