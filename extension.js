/*
 本extension的用途
 - 比較同名function參數的順序、命名是否一致
 
 2019-03-08T09:14:54+00:00
 第一次發布
*/

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const path = require('path');
const vscode = require('vscode');
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    // create a insert timestamp button on status bar
    
    
    var myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
    myStatusBarItem.text = '🕑'
    myStatusBarItem.tooltip = 'insert timestamp'
    myStatusBarItem.show();
    myStatusBarItem.command = 'extension.insert_timestamp';
    context.subscriptions.push(myStatusBarItem);
    
    context.subscriptions.push(vscode.commands.registerCommand('extension.insert_timestamp', function () {
        let editor = vscode.window.activeTextEditor
        let document = editor.document
        let selection = editor.selection
        let now = new Date();
        let zerofill = function(s,d){
            s = ''+s
            if (s.length >= d) return s
            var z = ''
            for(var i=s.length;i<d;i++){
                z += '0'
            }
            return z+s
        }
        let timestamp = now.getUTCFullYear()+'-'+zerofill(now.getUTCMonth(),2)+'-'+zerofill(now.getUTCDate(),2)+'T'+ zerofill(now.getUTCHours(),2)+':'+zerofill(now.getUTCMinutes(),2)+':'+ zerofill(now.getUTCSeconds(),2)+'+00:00'
        editor.edit(function(edit_builder){
            if (editor.selection.isEmpty) {
                // the Position object gives you the line and character where the cursor is
                edit_builder.insert(selection.active,timestamp)
            }            
            else{
                edit_builder.replace(selection, timestamp);
            }
        })
    }))
    

    let disposable = vscode.commands.registerCommand('extension.start', function () {
        // The code you place here will be executed every time your command is executed

        
        // Display a message box to the user
        //vscode.window.showInformationMessage('Hello World!');

        let editor = vscode.window.activeTextEditor
        const document = editor.document

        // Create and show a new webview
        const panel = vscode.window.createWebviewPanel(
            'voutline', // Identifies the type of the webview. Used internally
            'Visual Outline', // Title of the panel displayed to the user
            vscode.ViewColumn.One, // Editor column to show the new webview panel in.
            {
                enableScripts: true, 
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'src'))]                
            } // Webview options. More on these later.
        );
        //handle messages
        panel.webview.onDidReceiveMessage(
            message => {
              switch (message.do) {
                case 'alert':
                    vscode.window.showErrorMessage(message.text);
                    return;
                case 'get-editor-text':
                    panel.webview.postMessage({
                        do:'set_editor_text',
                        text:document.getText(),
                        path:document.fileName
                    })
                    break
                case 'goto-line':
                    vscode.window.showTextDocument(document).then(function(){
                        editor = vscode.window.activeTextEditor
                        let range = document.lineAt(message.line - 1).range;
                        editor.selection =  new vscode.Selection(range.start, range.end);
                        editor.revealRange(range);
                        //cancel selection
                        editor.selection = new vscode.Selection(range.start, range.start);
                    })
                    break
                case 'get-lines':
                    var lines = []
                    // lineAt() is 0-based, given data is 1-based, and include "end" line
                    var row = message.start - 1
                    var end = message.end
                    while (row < end && row < document.lineCount){
                        lines.push(document.lineAt(row).text)
                        row += 1
                    }
                    panel.webview.postMessage({
                        to:message.from,
                        retcode:0,
                        stdout:lines
                    })
                    break
                case 'search':
                    //returns an array of matched lines with 1-based
                    var row = 0
                    var keyword = message.keyword
                    var lines = []
                    while (row < document.lineCount){
                        var line = document.lineAt(row).text
                        if (line.indexOf(keyword) >= 0) lines.push(row+1)
                        row += 1
                    }
                    panel.webview.postMessage({
                        to:message.from,
                        retcode:0,
                        stdout:lines
                    })
                    break
                }
                
            },
            undefined,
            context.subscriptions
        );
        try{
            panel.webview.html = get_html(context)
        }
        catch(e){
            vscode.window.showInformationMessage('Error!');
            console.warn(e)
        }
        
    });
    context.subscriptions.push(disposable);
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
    activate,
    deactivate
}

function get_html(context){
    const src_path = vscode.Uri.file(path.join(context.extensionPath, 'src')).with({ scheme: 'vscode-resource' });
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="${src_path}/w2ui-1.5.rc1.min.css">        
        
        <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.8.1/css/all.css" integrity="sha384-50oBUHEmvpQ+1lW4y57PTFmhCaXp0ML5d60M1M7uH2+nqUivzIebhndOJK28anvf" crossorigin="anonymous">
        <script src="https://unpkg.com/esprima@~4.0.1/dist/esprima.js"></script>
        <script    src="https://code.jquery.com/jquery-3.3.1.min.js" integrity="sha256-FgpCb/KJQlLNfOu91ta32o/NMZxltwRo8QtmkMRdAu8="
        crossorigin="anonymous"></script>

        <script src="${src_path}/w2ui-1.5.rc1.min.js"></script>
        <script src="${src_path}/jsesprima.js"></script>
        <title>Visual Outline</title>
        <style>
        /* override vscode webview settings*/
        ::-webkit-scrollbar {
            width: 16px !important;
            height: 16px !important;
        }
        /* override vscode webview settings*/
        ::-webkit-scrollbar-track {
            -webkit-box-shadow: inset 0 0 6px rgba(0,0,0,0.3); 
            border-radius: 0px;
        }
        /* override vscode webview settings*/
        ::-webkit-scrollbar-thumb {
            border-radius: 0px;
            -webkit-box-shadow: inset 0 0 6px rgba(0,0,0,0.5); 
        }

        body{
            margin:0;
            padding:0;
        }
        #page{
            width:100vw;
            height:100vh;
            background-color:#f0f0f0;
        }
        .w2ui-grid-body table tr td{
            font-size:14px;
        }
        div.code{
            padding:0px 30px;
        }
        .code ol li{
            unicode-bidi: embed;
            font-family: monospace;
            white-space: pre;
            font-size:18px;
            line-height:18px;
            font-weight:bold;
            margin-bottom:5px;
        }
        .code ol li:hover{
            background-color:rgba(0,0,0,0.1);
        }
        .code li.hilight{
            box-sizing: border-box;
            background-color:#FBFEC0;
        }
        .code span.hilight{
            box-sizing: border-box;
            background-color:#C2F5B4;
        }
        </style>
</head>
<body>
<div id="page"></div>

<script language="javascript">
const vscode = acquireVsCodeApi();
window.addEventListener('DOMContentLoaded',function(){
    setup_initial_layout()
    vscode.postMessage({do:'get-editor-text'})
})

// global preferences
var preferences = {
    'load-what-to-main':'source'
}
// global vars
var cache = {
    L1_objects: null //object interpretation result
}

// request-style command register request-id in "requests"
var requests = {}

//implement global modal loading (w2ui-based)
window.loading = function (yes, message, showSpinner) {
    if (yes && window._loading_count) return ++window._loading_count
    if (yes) {
        window._loading_count = 1
        document.body.cursor = 'wait'
        w2utils.lock(document.body, message, showSpinner)
    }
    else if (window._loading_count) {
        window._loading_count -= 1
        if (window._loading_count == 0) {
            delete window._loading_count
            document.body.cursor = ''
            w2utils.unlock(document.body)
        }
    }
}
/* call this to receive response from backend extension */
function request_message(payload,callback){
    var request_id = '@'+new Date().getTime()
    payload.from = request_id
    requests[request_id] = callback
    vscode.postMessage(payload)
}    
    
window.addEventListener('message',function(evt){
    try
    {
        if (evt.data.to && requests[evt.data.to]){
            var callback = requests[evt.data.to]
            delete requests[evt.data.to]
            callback(evt.data)
        }
        else{
            message_handler(evt)
        }
    }
    catch(e){
      console.log(typeof(e.stack))
      document.getElementById('page').innerHTML = '<p>'+e.stack+'</p>'
    }
})

</script>
</body>
</html>`;
}

/*
function parse_js(){
    //我自己寫的js parser
    const editor = vscode.window.activeTextEditor
    const document = editor.document
    var L1_objects = {} //level 1 objects
    var tags = []
    var row = 0, text = null
    var problem_lines = []
    //flags
    var in_comment_block = false
    var in_L1_scope = false
    var deepth = 0 //counted by curly {}

    while (row < document.lineCount){
        var line = document.lineAt(row)
        text = line.text.trim()
        if (/^\/\*.+?\*\//.test(text)){
            //single line comments
            row += 1
            continue
        }
        else if (/^\/\* /.test(text)){
            in_comment_block = true
            //console.log('enter comment',row,':',text)
            row += 1
            continue
        }
        else if (in_comment_block && /\*\//.test(text)){
            //console.log('exit comment',row,':',text)
            in_comment_block = false
            row += 1
            continue
        }
        else if (in_comment_block){
            //console.log('enter comment',row,':',text)
            row += 1
            continue
        }
        else if (/^\/\//.test(text)){
            //console.log('skip line comment',row,':',text)
            row += 1
            continue
        }
        else{
            text = text.replace(/\/\/.*$/,'')
            var left_curly_m =  text.match(/[^\\]?{/g)
            var right_curly_m = text.match(/[^\\]?}/g)
            var left_curly_count_line = left_curly_m ? left_curly_m.length : 0
            var right_curly_count_line = right_curly_m ? right_curly_m.length : 0
            if (left_curly_m || right_curly_m){
                deepth += left_curly_count_line - right_curly_count_line
            }
            if (/^function\s/.test(text)){
                var m = text.match(/function\s+(\w+)\(/)
                if (m){
                    var func_name = m[1]
                    if (L1_objects[func_name]){
                        L1_objects[func_name].warns.push('duplication')
                    }
                    else{
                        L1_objects[func_name] = {
                            name:func_name,
                            type:'function',
                            text:text,
                            warns:[],
                            row:row,
                            methods:{},
                            classmethods:{}
                        }
                    }
                }
                else{
                    problem_lines.push({
                        row:row,
                        text:text
                    })
                }
            }
            else if (/^(\w+)\.prototype\s*\=/.test(text)){
                var m = text.match(/^(\w+)\.prototype\s*\=/)
                if (m){
                    var func_name = m[1]
                    if (L1_objects[func_name]) {
                        L1_objects[func_name].type = 'class'
                    }
                    else{
                        L1_objects[func_name] = {
                            name:func_name,
                            type:'class prototype',
                            text:text,
                            warns:['#'+row+':Orphane, class definition of '+func_name+' not found'],
                            methods:{},
                            classmethods:{}
                        }
                    }
                    in_L1_scope = func_name
                    // search member of <function>.prototype
                    //starts a sub looping
                    var in_sub_function = false
                    var in_sub_comment_block = false
                    var sub_deepth = left_curly_count_line - right_curly_count_line
                    var sub_deepth_top = deepth - sub_deepth
                    //console.log('deepth=',deepth,'sub_deepth_top=',sub_deepth_top,'sub_deepth=',sub_deepth)
                    row += 1
                    while(row < document.lineCount){
                        var subline = document.lineAt(row)
                        var subtext = subline.text.trim()
                        if (/^\/\*.+?\*\//.test(subtext)){
                            row += 1
                            continue
                        }
                        else if (/^\/\* /.test(subtext)){
                            in_sub_comment_block = true
                            //console.log('enter comment',row,':',text)
                            row += 1
                            continue
                        }
                        else if (in_sub_comment_block && /\*\//.test(subtext)){
                            //console.log('exit comment',row,':',text)
                            in_sub_comment_block = false
                            row += 1
                            continue
                        }
                        else if (in_sub_comment_block){
                            //console.log('enter comment',row,':',text)
                            row += 1
                            continue
                        }
                        else if (/^\/\//.test(subtext)){
                            //console.log('skip line comment',row,':',text)
                            row += 1
                            continue
                        }
                        else{
                            subtext = subtext.replace(/\/\/.*$/,'')
                            var sub_left_curly_m =  subtext.match(/[^\\]?{/g)
                            var sub_right_curly_m = subtext.match(/[^\\]?}/g)
                            var sub_left_curly_count_line = sub_left_curly_m ? sub_left_curly_m.length : 0
                            var sub_right_curly_count_line = sub_right_curly_m ? sub_right_curly_m.length : 0
                            var sub_delta_curly_count_line = 0
                            if (sub_left_curly_m || sub_right_curly_m){
                                sub_delta_curly_count_line = (sub_left_curly_count_line - sub_right_curly_count_line)
                                sub_deepth +=  sub_delta_curly_count_line
                                deepth = sub_deepth_top + sub_deepth
                                //console.log('#',row,'deepth=',deepth,'subdeepth=',sub_deepth,'delta-deepth=', sub_delta_curly_count_line,'text=',subtext)
                            }
                            if ((sub_deepth - sub_delta_curly_count_line) == 1 && /^,?\s*(\w+)\s*\:\s*function/.test(subtext)){
                                in_sub_function = true
                                //sub_function_deepth = sub_deepth 
                                var sub_m = subtext.match(/^,?\s*(\w+)\s*\:\s*function/)
                                if (sub_m){
                                    var method_name = sub_m[1]
                                    L1_objects[func_name].methods[method_name] = {
                                        name:method_name,
                                        row:row
                                    }
                                }
                                else{
                                    L1_objects[func_name].warns.push('#'+row+': unknown method:'+subtext)
                                }
                                //console.log('#',row,'enter sub funtion',method_name,'sub_deepth=',sub_deepth,'deepth=',deepth)    
                            }
                            else if (sub_right_curly_count_line){
                                if (in_sub_function && sub_deepth == 1){
                                    //end function
                                    in_sub_function = false
                                    //sub_function_deepth = 0
                                    //console.log('#',row,'exit sub funtion, sub_deepth=',sub_deepth,'sub_deepth_top=',sub_deepth_top)
                                }
                                if ((!in_sub_function) && deepth == 0){
                                    //end of <function>.prototype
                                    //console.log('exit prototype at row',row,',sub_deepth_top=',sub_deepth_top,',text=',subtext)
                                    break
                                }    
                            }
                        }
                        row += 1
                    }
                }
                else{
                    problem_lines.push({
                        row:row,
                        text:text
                    })
                }
            }//end of .prototype
            else if (/^(\w*)\.(\w*)\s*=/.test(text)){
                var m = text.match(/^(\w*)\.(\w*)\s*=/)
                var func_name = m[1], property_name = m[2]
                if (L1_objects[func_name]){
                    L1_objects[func_name].classmethods[property_name] = {
                        name:property_name,
                        row:row
                    }
                }
            }
        }
        row += 1
    }
    //generate output
    //; convert dict to list for sorting
    tags.push('<h1>'+document.fileName.split('/').pop()+'</h1>')
    tags.push('<p>'+document.fileName+'</p>')
    var L1_objects_list = []
    for (var func_name in L1_objects){
        L1_objects_list.push(L1_objects[func_name])
    }
    L1_objects_list.sort(function(a,b){return (a.row > b.row) ? 1 : (a.row < b.row ? -1 : 0)})
    L1_objects_list.forEach(function(obj){
        var name = obj.name
        tags.push('<div style="font-size:16px">')
        tags.push('<h3><a href="#" class="goto-line" line="'+obj.row+'">'+obj.type+': '+name+'</a></h3>')
        tags.push('<div style="padding-left:20px">') //content

        // convert dict to list for sorting
        var classmethods = []
        for (var method_name in obj.classmethods){
            classmethods.push(obj.classmethods[method_name])
        }
        classmethods.sort(function(a,b){return (a.row > b.row) ? 1 : (a.row < b.row ? -1 : 0)})
        classmethods.forEach(function(method){
            tags.push('<p>class-method:<a href="#" class="goto-line" line="'+method.row+'">'+method.name+'</a></p>')
        })

        // convert dict to list for sorting
        var methods = []
        for (var method_name in obj.methods){
            methods.push(obj.methods[method_name])
        }
        methods.sort(function(a,b){return (a.row > b.row) ? 1 : (a.row < b.row ? -1 : 0)})
        methods.forEach(function(method){
            tags.push('<p>method:<a href="#" class="goto-line" line="'+method.row+'">'+method.name+'</a></p>')
        })

        obj.warns.forEach(function(warn){
            tags.push('<p>'+warn+'</p>')
        })        
        tags.push('</div>') //end of content
        tags.push('</div>')
    })
    problem_lines.forEach(function(item){
        tags.push('<p>Unknow #'+item.row+':'+item.text)
    })
    tags.push('<p>Total:#'+row+'</p>')
    return tags.join('')
}
*/