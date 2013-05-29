// alter table comments drop contact;
// alter table comments modify column author varchar(256);
/*  create table posts (
        id integer not null auto_increment,
        title varchar(128) not null,
        body text not null,
        created timestamp default current_timestamp, // See reference. Otherwise automatic stuff happens. Not good.
        modified timestamp default null on update current_time_stamp,
        primary key (id)
    );
    create table comments (
        id integer not null auto_increment,
        post_id integer not null,
        author varchar(256) not null,
        body text not null,
        created timestamp default current_timestamp,
        modified timestamp default null on update current_time_stamp,
        primary key (id)
    );
    // 256 is max email address length;
    create table portfolio (
        id integer not null auto_increment,
        title varchar(64),
        url varchar(256) not null,
        thumbnail varchar(256),
        description text
    );
*/
module.exports = (function (){        
    var mysql = require("mysql");
    var database_creator = function (_configuration, _callback){
        var database = {
            setup: function (configuration, callback){
                var self = this;
                self.database_name = configuration.database_name;
                if(!this.database_name){
                    if(callback){ callback();}
                    return;
                }
                self.host = configuration.host;
                self.user = configuration.user;
                self.password = configuration.password;
                var connection = mysql.createConnection({
                    host     : self.host,
                    user     : self.user,
                    password : self.password,
                    multipleStatements: true
                });
                connection.connect();
                connection.query('use '+self.database_name+';', function (error, result){
                    if(error && error.code == "ER_BAD_DB_ERROR"){
                        var query =[
                            'create database '+self.database_name,
                            'use '+self.database_name,
                            'create table posts (id integer unique not null auto_increment, title varchar(128) not null, body text not null, created timestamp default current_timestamp, modified timestamp null, primary key (id))',
                            'create table comments (id integer unique not null auto_increment, post_id integer not null, author varchar(256) not null, body text not null, created timestamp default current_timestamp, modified timestamp null, primary key (id))',
                            'create table portfolio (id integer unique not null auto_increment, title varchar(64), url varchar(256) not null, thumbnail varchar(256), description text)'
                        ].join("; ")
                        connection.query(query, function (error, result){
                            connection.end();
                            if(error){
                                self.fouled = true;
                            } else if(callback){
                                callback();
                            }
                        });
                    } else{
                        connection.end();
                    }
                });
            },
            insert: function (table, keys, values, callback){
                var connection = mysql.createConnection({
                    host     : this.host,
                    user     : this.user,
                    password : this.password,
                    database : this.database_name
                });
                for(var index = 0; index < values.length; index++){
                    var indexed_value = values[index];
                    var indexed_number = parseInt(indexed_value, 10);
                    if(indexed_number == indexed_number){ // The only value for which this isn't true is NaN.
                        indexed_value = indexed_number;
                    }
                    indexed_value = connection.escape(indexed_value);
                    values[index] = indexed_value;
                }
                var query = "insert into "+table+" ("+keys.join(", ")+") value("+values.join(", ")+");";
                connection.query(query, function (error, result){
                    connection.end();
                    if(callback){
						console.log('==================================')
						console.log('Error: '+error)
						console.log('Result: '+result);
                        callback(error, result);
                    }
                });
            },
            update: function (table, keys, values, callback){
                var connection = mysql.createConnection({
                    host     : this.host,
                    user     : this.user,
                    password : this.password,
                    database : this.database_name
                });
                var id_pos = keys.indexOf('id');
                var row_id = values[id_pos];
                if(!row_id && callback){
                    callback('A row ID must be supplied.')
                    return;
                }
                keys.splice(id_pos, 1);
                values.splice(id_pos, 1);
                for(var index = 0; index < values.length; index++){
                    var indexed_value = values[index];
                    var indexed_number = parseInt(indexed_value, 10);
                    if(indexed_number == indexed_number){ // The only value for which this isn't true is NaN.
                        indexed_value = indexed_number;
                    }
                    indexed_value = connection.escape(indexed_value);
                    values[index] = indexed_value;
                }
                // UPDATE table_name SET identifier=value,iden2=value2 WHERE selection_statement;
                var update_formatted = '';
                for(var key_index = 0; key_index < keys.length; key_index++){
                    if(key_index > 0){
                        update_formatted += ',';
                    }
                    update_formatted += keys[key_index]+'='+values[key_index];
                }
                var query = 'update '+table+' set '+update_formatted+' where id = '+row_id+';';
                connection.query(query, function (error, result){
                    connection.end();
                    if(callback){
                        callback(error, result);
                    }
                });
            },
            retrieve: function (table, parameters, callback){
                // TODO: Date ranges, number, etc
                var connection = mysql.createConnection({
                    host     : this.host,
                    user     : this.user,
                    password : this.password,
                    database : this.database_name
                });
                var id = parseInt(parameters.id, 10);
                var post_id = parseInt(parameters.post_id);
                var query;
                var count_query;
                var skip_amount = Math.max(0, parameters.skip);
                if(id){
                    query = 'select * from '+table+' where id = '+id+';';
                    count_query = 'select count(*) from '+table+' where id = '+id+';';
                } else if(post_id){
                    query = 'select * from '+table+' where post_id = '+post_id+' order by created desc limit 5;';
                    count_query = 'select count(*) from '+table+' where post_id = '+post_id+';';
                }
                else if(skip_amount){
                    console.log(skip_amount)
                    query = 'select * from '+table+' order by created desc limit 5 offset '+skip_amount+';';
                    console.log(query)
                    count_query = 'select count(*) from '+table+';';
                } else{
                    query = "select * from "+table+" order by created desc limit 5;";
                    count_query = 'select count(*) from '+table+';';
                }
                //console.log(query)
                //connection.escape(query);
                connection.query(count_query, function (error, result){
                    if(!error){
                        var count = result[0]['count(*)'];
                        if(!count){
                            connection.end();
                            callback(undefined, []);
                            return;
                        } else{
                            var result_number = count - skip_amount;
                            var bug; // https://github.com/felixge/node-mysql/issues/403
                            if(result_number == 1){
                                query = 'select * from '+table+' order by created limit 1;';
                                // Only grab the last item. This whole bit of logic is because of a bug in
                                // the mysql library: https://github.com/felixge/node-mysql/issues/403
                            }
                            connection.query(query, function (error, result){
                                connection.end();
                                if(!error){
                                    result._count = count;
                                    result._skip = parameters.skip;
                                }
                                if(callback){
                                    callback(error, result);
                                }
                            });
                        }
                    }
                });
            },
            count: function (table, parameters, callback){
                // TODO: This function only counts comments
                var connection = mysql.createConnection({
                    host     : this.host,
                    user     : this.user,
                    password : this.password,
                    database : this.database_name
                });
                var id = parseInt(parameters.id, 10);
                var query = 'select count(*) from '+table+' where post_id = '+id+';';
                connection.query(query, function (error, result){
                    // result = [ { 'count(*)': 2 } ]
                    var first_item = result[0];
                    var number = first_item['count(*)'];
                    connection.end();
                    if(callback){
                        callback(error, number);
                    }
                });
            },
            delete_row: function (table, row_id, callback){
                var connection = mysql.createConnection({
                    host     : this.host,
                    user     : this.user,
                    password : this.password,
                    database : this.database_name
                });
                var id = parseInt(row_id, 10);
                var query = 'delete from '+table+' where id = '+row_id+';';
                connection.query(query, function (error, result){
                    connection.end();
                    if(callback){
                        callback(error, result);
                    }
                })
            }
        };
        database.setup(_configuration, _callback);
        return database;
    };
    return database_creator;
})();