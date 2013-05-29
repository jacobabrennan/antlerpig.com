module.exports = (function (){
    var for_async = function (init_object, condition, increment, body, callback){
        var iterator = function (){
            if(condition(init_object)){
                body(init_object, function (){
                    increment(init_object);
                    setTimeout(iterator, 0);
                })
            } else{
                callback();
            }
        };
        iterator();
    }
    return for_async;
})();

/* Old Recursive Pattern:
    var indexed_post;
    var parsed_text = '';
    var result_index = 0;
    var result_length = (result? result.length : 0);
    var r_iterator = function (){
        if(result_index < result_length){
            indexed_post = result[result_index];
            result_index++;
            var show_comments = false;
            if(result_length == 1){
                show_comments = true;
            }
            blog.display_post(indexed_post, show_comments, function(parsed_post){
                parsed_text += parsed_post;
                r_iterator();
            });
        } else{
            document.text += parsed_text;
            callback(document);
        }
    }
    r_iterator('');
*/