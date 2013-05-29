var parser = exports;
parser.rule = /<core\[([^\]]*)\]>/ig;
parser.parse = function (req, string, command, callback){
    //return string.replace(parser.rule, command);
    var fragments_and_captures = string.split(parser.rule);
    var fragment_index = 0;
    var parsed_string = '';
    var id = Math.floor(Math.random()*10000);
    var calls = 0;
    var iterator = function (replacement){
        parsed_string += replacement;
        parsed_string += fragments_and_captures[fragment_index];
        var capture = fragments_and_captures[fragment_index+1];
        if(capture !== undefined){
            fragment_index += 2;
            command(req, capture, iterator);
        } else{
            calls++;
            callback(parsed_string);
        }
    };
    iterator('');
};