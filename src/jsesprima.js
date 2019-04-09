//import { window } from "vscode";

function message_handler(evt){
    switch(evt.data.do){
        case 'set_editor_text':
            var obj = esprima.parseScript(evt.data.text, {loc:true, comment:true, attachComment:true})
            var filename = evt.data.path.split('/').pop()
            var L1_objects = parse_objects(obj)
            window.cache.L1_objects = L1_objects //save to cache
            // generate sidebar
            var nodes = []
            nodes.push({
                id:'general',
                text:'General',
                group:true,
                expanded:true,
                nodes:[
                    {id:'all-list',text:'Object List'}
                ]
            })
            var L1_objects_list = []
            for (var func_name in L1_objects){
                L1_objects_list.push(L1_objects[func_name])
            }
            L1_objects_list.sort(function(a,b){return a.row.start - b.row.start})
            L1_objects_list.forEach(function(L1_object){
                var subnodes = [
                    {
                        id:L1_object.name+'.this'
                        ,text:L1_object.name
                        ,img:'fa fa-bullseye'
                        ,type:L1_object.type
                    }
                ]
                var classmembers = []
                for (var member_name in L1_object.classmember){
                    classmembers.push(L1_object.classmember[member_name])					
                }
                classmembers.sort(function(a,b){return a.row.start - b.row.start})
                classmembers.forEach(function(member){
                    subnodes.push({
                        id:L1_object.name+'.'+member.name
                        ,text:member.name
                        ,img:'fa fa-file'
                        ,type:'Classmember'
                    })
                })

                var members = []
                for (var member_name in L1_object.member){
                    members.push(L1_object.member[member_name])
                }
                members.sort(function(a,b){return a.row.start - b.row.start})
                members.forEach(function(member){
                    subnodes.push({
                        id:L1_object.name+'.prototype.'+member.name
                        ,text:member.name
                        ,img:'fa fa-bolt'
                        ,type:'instance-method'
                    })
                })
                var node = {
                    id:L1_object.name, 
                    text:L1_object.name, 
                    img: L1_object == 'Class' ? 'fa fa-box' : 'fa fa-bolt', 
                    expanded:false, 
                    group:true,
                    nodes:subnodes
                }
                nodes.push(node)
            })

            $().w2sidebar({
                name:'sidebar',
                topHTML:'<div style="background-color: #eee; font-size:16px;padding: 10px 5px; border-bottom: 1px solid silver">'+filename+'</div>',
                nodes:nodes,
                onClick:function(evt){
                    switch(evt.target){
                        case 'all-list':
                            try{
                                render_all_list()
                            }
                            catch(e){
                                console.log(e.stack)
                            }
                            break
                        default:
                            var names = evt.target.split('.')
                            var L1_object = L1_objects[names[0]]
                            var target_obj = null
                            var keyword
                            if (names[1] == 'this'){
                                target_obj = L1_object
                                keyword = names[0]
                            }
                            else if (names[1] == 'prototype'){
                                target_obj = L1_object.member[names[2]]
                                keyword = '.'+names[2]
                            }
                            else{
                                target_obj = L1_object.classmember[names[1]]
                                keyword = '.'+names[1]
                            }
                            show_source(target_obj.row.start, target_obj.row.end)
                            
                            setTimeout(function(){
                                search_source_code(keyword)
                            })
                    }
                }
            })
            w2ui['page'].content('left',w2ui['sidebar'])
            //auto click to show all object list
            w2ui['sidebar'].click('all-list')
        break
    }
}
//Convert esprima result into objects

function parse_objects(obj){
    var L1_objects = {}
    obj.body.forEach(function(ele){
        // see http://esprima.org/demo/parse.html for prased results
        var comments = []
        var comments_list = [ele.leadingComments , ele.comments , ele.innerComments, ele.trailingComments]
        comments_list.forEach(function(comment_list){
            if (!comment_list) return
            comment_list.forEach(function(comment){
                comments.push(comment.value)
            })
        })
        switch(ele.type){
            case 'FunctionDeclaration':
                var func_name = ele.id.name
                var params = []
                ele.params.forEach(function(param){
                    params.push(param.name)
                })
                L1_objects[func_name] = {
                    name:func_name,
                    type:'Function',
                    classmember:{},
                    member:{},
                    row:{ //這是constructor的範圍
                        start:ele.loc.start.line,
                        end:ele.loc.end.line
                    },
                    params:params,
                    data_type:func_name,
                    comments:comments
                }
                break
            case 'ExpressionStatement':
                //<var_name>.<property_name> = 
                if (ele.expression.type == 'AssignmentExpression'){
                    var var_name = ele.expression.left.object.name
                    var property_name = ele.expression.left.property.name
                    // Class method or property
                    if (L1_objects[var_name]){
                        //make type more readiable
                        var left_member_obj = ele.expression.left
                        var right_member_obj = ele.expression.right
                        var member_type = right_member_obj.type
                        var member_data_type = ''
                        var member_params = []
                        switch(member_type){
                            case 'FunctionExpression':
                                member_type = 'class-method'
                                member_data_type = 'Function'
                                right_member_obj.params.forEach(function(param){
                                    member_params.push(param.name)
                                }) 
                                break
                            case 'ArrayExpression':
                                member_type = 'ClassProperty'
                                member_data_type = 'Array'
                                break
                            case 'Identifier':
                                member_type = 'ClassProperty'
                                member_data_type = ''
                                break
                        }
                        //collect comments
                        var member_comments = []                                
                        var comments_list = [
                            left_member_obj.leadingComments 
                            ,left_member_obj.comments 
                            ,left_member_obj.innerComments
                            ,left_member_obj.traillingComments
                            ,right_member_obj.leadingComments 
                            ,right_member_obj.comments 
                            ,right_member_obj.innerComments
                            ,right_member_obj.traillingComments
                        ]
                        comments_list.forEach(function(comment_list){
                            if (!comment_list) return
                            comment_list.forEach(function(comment){
                                member_comments.push(comment.value)
                            })
                        })
                                                            
                        L1_objects[var_name].classmember[property_name] = {
                            name:property_name,
                            row:{
                                start:ele.expression.loc.start.line,
                                end:ele.expression.loc.end.line
                            },
                            type:member_type,
                            data_type:member_data_type,
                            comments:member_comments,
                            params:member_params
                        }

                        // Since "prototype" is defined, This object is a class
                        // Lets dig into "prototype"
                        if (property_name == 'prototype'){
                            L1_objects[var_name].type = 'class'
                            
                            var properties = [] //methods-array
                            switch(ele.expression.right.type){
                                case 'ObjectExpression':
                                    //X.prototype = {}
                                    properties = ele.expression.right.properties
                                    break
                                case 'CallExpression':
                                    //X.prototype = _.create(Y.prototype,{})
                                    if (ele.expression.right.callee.property.name == 'create' && 
                                        ele.expression.right.arguments[1].type == 'ObjectExpression'
                                        ){
                                        properties = ele.expression.right.arguments[1].properties
                                    }
                                    break
                                case 'FunctionExpression':
                                    //X.prototype = function(){}
                                    break
                            }
                            
                            properties.forEach(function(prop_obj){
                                var prop_name = prop_obj.key.name
                                var prop_type = prop_obj.value.type
                                var prop_data_type = ''
                                var prop_params = []
                                switch(prop_type){
                                    case 'FunctionExpression':
                                        prop_type = 'Method'
                                        prop_data_type = 'Function'
                                        prop_obj.value.params.forEach(function(param){
                                            prop_params.push(param.name)
                                        })                                                
                                        break
                                    case 'ArrayExpression':
                                        prop_type = 'Array'
                                        prop_data_type = 'Array'
                                        break
                                    case 'Identifier':
                                        prop_type = 'Property'
                                        prop_data_type = ''
                                        break
                                }
                                
                                var prop_comments = []
                                var comments_list = [
                                    prop_obj.leadingComments 
                                    , prop_obj.comments
                                    , prop_obj.innerComments
                                    , prop_obj.traillingComments
                                ]
                                comments_list.forEach(function(comment_list){
                                    if (!comment_list) return
                                    comment_list.forEach(function(comment){
                                        prop_comments.push(comment.value)
                                    })
                                })

                                                                        
                                L1_objects[var_name].member[prop_name] = {
                                    name: prop_name,
                                    type: 'instance-method',
                                    row:  {
                                        start:prop_obj.loc.start.line,
                                        end:prop_obj.loc.end.line
                                    },
                                    data_type:prop_data_type,
                                    comments:prop_comments,
                                    params:prop_params
                                }
                            })
                            
                        }
                    }

                }
                break
            case 'VariableDeclaration':
                //var Widget = function(ele) {...}
                var L1_name = ele.declarations[0].id.name
                var params = []
                var comments_list = [
                    ele.declarations[0].leadingComments,
                    ele.declarations[0].trailingComments
                ]
                switch(ele.declarations[0].init.type){
                    case 'FunctionExpression':
                        ele.declarations[0].init.params.forEach(function(param){
                            params.push(param.name)
                        })
                        comments_list.push(ele.declarations[0].init.body.body[0].leadingComments)
                        break
                    case 'ObjectExpression':
                        comments_list.push(ele.declarations[0].init.properties[0].leadingComments)
                        break
                }
                var comments = []
                //if (! ele.declarations[0].init.body) console.log('no body '+L1_name)
                //console.log(':::'+ele.declarations[0].init.body)
                comments_list.forEach(function(comment_list){
                    if (!comment_list) return
                    comment_list.forEach(function(comment){
                        comments.push(comment.value)
                    })
                })                        
                L1_objects[L1_name] = {
                    name:L1_name,
                    type:'global-variable',
                    classmember:{},
                    member:{},
                    row:{ //這是constructor的範圍
                        start:ele.loc.start.line,
                        end:ele.loc.end.line
                    },
                    params:params,
                    data_type:ele.declarations[0].init.type,
                    comments:comments
                }
                break
            default:
                console.log('unknow type',ele.type)
        }
    })
    return L1_objects
}

/*
 generate layout
*/
function setup_initial_layout(){
    var root = document.getElementById('page')
    $(root).w2layout({
        name:'page',
        panels:[
            {type:'left',size:250, resizable:true}
            ,{type:'main',size:'50%',resizable:true}
            ,{type:'preview',size:'50%',resizable:true,hidden:true}
        ]
    })
}
function render_all_list(){
    var L1_objects = window.cache.L1_objects
    var records = []
    var max_params_length = 0
    var L1_objects_list = []
    for (var func_name in L1_objects){
        L1_objects_list.push(L1_objects[func_name])
    }
    L1_objects_list.sort(function(a,b){return a.row.start - b.row.start})
    L1_objects_list.forEach(function(L1_object){
        var comments = []
        if (L1_object.comments.length){
            L1_object.comments.forEach(function(comment){
                comments.push(comment)
            })
        }
        //L1 record
        var record = {
            recid:L1_object.name,
            type:L1_object.type,
            topname:L1_object.name,
            name:'',
            comments:comments.join('\n'),
            start:L1_object.row.start,
            end:L1_object.row.end,
            lines: L1_object.row.end - L1_object.row.start + 1,
            w2ui:{
                style: 'background-color:#C2F5B4'
            }
        }
        max_params_length = Math.max(max_params_length, L1_object.params.length)
        L1_object.params.forEach(function(param,idx){
            record['arg'+(idx+1)] = param
        })
        records.push(record)

        //L2 record
        var classmembers = []
        for (var member_name in L1_object.classmember){
            classmembers.push(L1_object.classmember[member_name])					
        }
        classmembers.sort(function(a,b){return a.row.start - b.row.start})
        classmembers.forEach(function(member){
            var comments = []
            if (member.comments.length){
                member.comments.forEach(function(comment){
                    comments.push(comment)
                })
            }             
            var record = {
                recid:L1_object.name+'.'+member.name,
                type:member.type,
                topname:L1_object.name,
                name:member.name,
                comments:comments.join('\n'),
                start:member.row.start,
                end:member.row.end,
                lines: member.row.end - member.row.start + 1,
                w2ui:{
                    style: 'background-color:#FBFEC0'
                }                
            }
            max_params_length = Math.max(max_params_length, member.params.length)
            member.params.forEach(function(param,idx){
                record['arg'+(idx+1)] = param
            })    
            records.push(record)
        })
        // L2 record
        var members = []
        for (var member_name in L1_object.member){
            members.push(L1_object.member[member_name])
        }
        members.sort(function(a,b){return a.row.start - b.row.start})
        members.forEach(function(member){
            var comments = []
            if (member.comments.length){
                member.comments.forEach(function(comment){
                    comments.push(comment)
                })
            }             
            var record = {
                recid:L1_object.name+'.prototype.'+member.name,
                type:member.type,
                topname:L1_object.name,
                name:member.name,
                comments:comments.join('\n'),
                start:member.row.start,
                end:member.row.end,
                lines: member.row.end - member.row.start + 1
            }
            max_params_length = Math.max(max_params_length, member.params.length)
            member.params.forEach(function(param,idx){
                record['arg'+(idx+1)] = param
            })
            records.push(record)
        })
    })
    
    // generate columns dynamically 
    var columns = [
        {field:'start',caption:'#', size:40, type:'text', sortable:true}
        ,{field:'lines',caption:'Len', size:40, type:'text', sortable:true,attr:'align=right'}
        ,{field:'topname',caption:'Top Name', size:100, type:'text', sortable:true}
        //,{field:'type',caption:'Type', size:50, type:'text', sortable:true}
        ,{field:'name',caption:'Name', size:150, type:'text', sortable:true}
    ]
    for (var i=0;i<max_params_length;i++){
        columns.push({field:'arg'+(i+1),caption:'Arg'+(i+1), size:50, type:'text'})
    }
    columns.push({field:'comments',caption:'Comments', size:400, type:'text'})

    if (w2ui['all_list']) w2ui['all_list'].destroy()
    $().w2grid({
        name:'all_list',
        multiSort:true,
        style:'font-size:20px',
        show:{
            toolbar:true,
            toolbarAdd:false,
            toolbarDelete:false,
            toolbarSearch:true,
            toolbarReload:false,
            toolbarColumns:true,
            toolbarInput:true,
            emptyRecords:false,
            lineNumbers : false
        },
        columns: columns,
        onSearch:function(evt){
            //console.log(JSON.stringify(evt.searchData))
        },
        onSelect:function(evt){
            var names = evt.recid.split('.')
            var L1_object = L1_objects[names[0]]
            var target_obj
            if (names.length == 1){
                target_obj = L1_object
            }
            else if (names.length == 2){
                target_obj = L1_object.classmember[names[1]]
            }
            else if (names.length == 3){
                target_obj = L1_object.member[names[2]]
            }

            if (window.preferences['load-what-to-main'] == 'source') {
                show_source(target_obj.row.start, target_obj.row.end)
            }
            else {
                show_comment(target_obj)
            }
        }
    })
    w2ui['page'].content('main',w2ui['all_list'])
    setTimeout(function(){
        w2ui['all_list'].records = records.slice()
        
        w2ui['all_list'].toolbar.add([
            {
                icon:'fa fa-code',type:'button',id:'go-line',text:'Go', tooltip:'go to source file',
                onClick:function(evt){
                    var recids = w2ui['all_list'].getSelection()
                    if (recids.length == 0) return
                    var names = recids[0].split('.')
                    var L1_object = L1_objects[names[0]]
                    var target_obj
                    if (names.length == 1){
                        target_obj = L1_object
                    }
                    else if (names.length == 2){
                        target_obj = L1_object.classmember[names[1]]
                    }
                    else if (names.length == 3){
                        target_obj = L1_object.member[names[2]]
                    }
                    if (target_obj) vscode.postMessage({do:'goto-line',line:target_obj.row.start})
                }
            }
            ,{type:'break'}
            ,{type: 'radio', id: 'load-source-to-main', group: '1', text: 'Look Source', icon: 'fa-star', checked: true,
                onClick:function(){
                    window.preferences['load-what-to-main'] = 'source'
                } }
            ,{type: 'radio', id: 'load-comment-to-main', group: '1', text: 'Look Comments', icon: 'fa-heart',
                onClick:function(){
                    window.preferences['load-what-to-main'] = 'comment'
                }}
            ,{type:'break'}
            ,{ type: 'html',  id: 'source-search', tooltip:'search source code', value:'',
                html: function (item) {
                    var html =
                    '<div style="padding: 3px 10px;">'+
                    '    <input size="20" placeholder="keyword" onchange="search_source_code(this.value)" '+
                    '         value="'+item.value+'"'+
                    '         style="font-size:14px;padding: 1px; border-radius: 2px; border: 1px solid silver"/>'+
                    '    <span>'+(typeof item.found == 'undefined' ? '' : item.found+' found')+'</span>'+
                    '</div>';
                    return html;
                }
            },
        ])        
        w2ui['all_list'].refresh()
    },10)
}
function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }
function show_source(start,end){
    request_message({do:'get-lines',start:start,end:end},function(response){
        if (response.retcode == 0){
            var lines = response.stdout
            var tags = ['<div class="code">','<ol start="'+start+'">']
            var reg = window.cache.keyword ? new RegExp(window.cache.keyword,'gi') : null
            lines.forEach(function(line){
                line = escapeHtml(line)
                if (reg && reg.test(line)) {
                    line = line.replace(reg,'<span class="hilight">'+window.cache.keyword+'</span>')
                    tags.push('<li class="hilight">'+line+'</li>')
                }
                else tags.push('<li>'+line+'</li>')
            })
            tags.push('</ol></div>')
            w2ui['page'].show('preview')
            w2ui['page'].content('preview',tags.join(''))
        }
    })    
}

function show_comment(target_obj){
    var tags = ['<div class="comment">']
    target_obj.comments.forEach(function(line){
        tags.push('<p>'+line+'</p>')
    })
    tags.push('</div>')
    w2ui['page'].show('preview')
    w2ui['page'].content('preview',tags.join(''))
}

function search_source_code(keyword){
    keyword = keyword.trim()
    window.cache.keyword = keyword
    // empty string to reset
    if (!keyword) {
        w2ui['all_list'].toolbar.get('source-search').value = keyword
        w2ui['all_list'].toolbar.get('source-search').found = undefined
        w2ui['all_list'].toolbar.refresh('source-search')    
        return mark_all_list_table()
    }
    
    var L1_objects = window.cache.L1_objects
    window.loading(true)
    request_message({do:'search',keyword:keyword},function(response){
        window.loading(false)
        if (response.retcode != 0) console.log(response.stderr)
        var line_nos = response.stdout //lines contains the keyword, let's find which object it is
        var recids = {} //records to hilight
        var found_count = 0
        line_nos.forEach(function(line_no){
            var recid = null
            for(var L1_name in L1_objects){
                var L1_object = L1_objects[L1_name]
                for (var member_name in L1_object.member){
                    if (L1_object.member[member_name].row.start <= line_no && line_no <= L1_object.member[member_name].row.end){
                        recid = L1_name + '.prototype.' + member_name
                        break
                    }
                }
                if (recid) break //record found
                for (var member_name in L1_object.classmember){
                    if (L1_object.classmember[member_name].row.start <= line_no && line_no <= L1_object.classmember[member_name].row.end){
                        recid = L1_name + '.' + member_name
                        break
                    }
                } 
                if (recid) break
                //if record not found in class methods or instance methods, lets seach class definition
                if (L1_object.row.start <= line_no && line_no <= L1_object.row.end){
                    recid = L1_name
                    break
                }
            }
            
            if (recid) {
                recids[recid] = 1
                found_count += 1
            }
        })
        mark_all_list_table(recids,'background-color:red;color:white;')

        w2ui['all_list'].toolbar.get('source-search').value = keyword
        w2ui['all_list'].toolbar.get('source-search').found = found_count
        w2ui['all_list'].toolbar.refresh('source-search') 

    })
}

/* 集中一個地方操作all_list 表格的標注 */
function mark_all_list_table(recids,style){
    // recids:(array;optional) if not given, reset all marks
    w2ui['all_list'].records.forEach(function(record){
        if (recids && recids[record.recid]){
            record.w2ui = {style:style}
        }
        else if (record.recid.indexOf('.prototype.') > 0){ //instance-method
            delete record.w2ui 
        }
        else if (record.recid.indexOf('.') > 0){ //classmethod
            record.w2ui = {style:'background-color:#C2F5B4'}
        }
        else{
            record.w2ui = {style:'background-color:#FBFEC0'}
        }
    })
    w2ui['all_list'].refresh()    
}
