var async = require('async');
var mongo = require('mongodb');
var Server = mongo.Server,
	Db = mongo.Db,
	BSON = mongo.BSONPure;

	server = new Server(process.env.OPENSHIFT_MONGODB_DB_HOST||'localhost', process.env.OPENSHIFT_MONGODB_DB_PORT||27017, {auto_reconnect: true});
	
/*
MongoDB 2.2 database added.  Please make note of these credentials:
   Root User:     admin
   Root Password: U66Rer1V_lpf
   Database Name: xtraxt
Connection URL: mongodb://$OPENSHIFT_MONGODB_DB_HOST:$OPENSHIFT_MONGODB_DB_PORT/
*/
	db = new Db('xtraxt', server);

	db.open(function(err, db) {
	    if(!err) {
	        console.log("Connected to 'xtraxt' database");
			if(process.env.NODE_ENV == "development"){
				db.admin().authenticate('admin', 'U66Rer1V_lpf', function(de , db){
				     if(e){
				         console.log("could not authenticate");
				     }else {
				    console.log('auth connected to database :: ' );
				     }
				     });
			}
			
	        db.collection('xtraxt', {strict:true}, function(err, collection) {
	            if (err) {
	                console.log("The 'xtraxt' collection doesn't exist. Creating it with sample data...");
	                //populateDB();
	            }
	        });
	    }
	});



	function cmd_exec(cmd, args, options, cb_stdout, cb_end) {
		var spawn = require('child_process').spawn,
		child = spawn(cmd, args, options),
		me = this,
		/*
		me = this;
		me.exit = 0;  // Send a cb to set 1 when cmd exits
		child.stdout.on('data', function (data) { cb_stdout(me, data) });
		child.stdout.on('end', function () { cb_end(me) });
		*/
		result = '';
		child.stdout.on('data', function(data) {
			result += data.toString();
		});
		child.on('exit', function(code) {
			console.log("result:"+result);
			return cb_end(me,result);	
		});
	}


	function getClientAddress(req){ 
	    with(req)
	        return (headers['x-forwarded-for'] || '').split(',')[0] 
	            || connection.remoteAddress;
	}


exports.xtraxt= function(req,res){
		req.setEncoding("utf8");
		var ip = getClientAddress(req);
		var u = "http://"+req.body.u;
		var x = req.body.x;
		var o = req.body.o;
		var i = req.body.i;
		var m = req.body.m;
		console.log("method:"+m)
		var c = '';
		var requestId = '';
		var orgText ='';
		var xtext,
		xtext1;
		//save the request in mongo
		var xset = [
			{"url":u, "ip":ip},
		];
		var locals={};

		async.series([
			//save the request to mongo
			function(callback){
				db.collection('xtraxt', function(err, collection) {
					collection.insert(xset, {safe:true}, function(err, result) {
						if(err){
							console.log("error saving to mongo")
						}
						else{
							console.log("saved request to db:"+result[0]._id);
							requestId = result[0]._id;
							console.log("got _id:"+requestId);
						}
					});
					callback();
				});
			},
			//fetch the url
			function(callback){
				var request = require('request');
				var ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/27.0.1453.110 Safari/537.36";
				request({ method: 'GET' ,uri: u, headers: {'User-Agent': ua}}, function (error, response, body) {
					if(error){
				        console.log(error);
						res.send({doc:orgText,xtext:"<html><body><div>"+error.stack+"</div></body</html>"});
						callback();
					} else {
						//store the retreived text in a var
						orgText = body;
						console.log("fetched the url:" + u)
						callback();
					}

				});
			},
			//save the original text to mongo
			function(callback){
				db.collection('xtraxt', function(err, collection) {
		        	collection.update({'_id':requestId}, {orgText:orgText}, {safe:true}, function(err, result) {
			            if (err) {
			                console.log('Error updating doc: ' + err);
			                res.send({xtext:'An error has occurred while saving to db'});
							callback();
			            } else {
			                console.log('' + result + ' document(s) updated');
							console.log("saved:"+" into: "+requestId)
							callback();

			            }
			        });

		    	});

			},
			// extract readable content using user requested method

			function(callback){
				if(m=="b"){
					var cmd = "/usr/bin/java";
					var foo = new cmd_exec(cmd, [
							"-cp",
							"src/demo:dist/boilerpipe-1.2.0.jar:lib/nekohtml-1.9.13.jar:lib/xerces-2.9.1.jar:lib/mongo-java-driver-2.11.1.jar",
							"de.l3s.boilerpipe.demo.xtraxt",
							requestId
						],
						{
							//stdio:"inherit",
							cwd:'/Users/raj/Projects/test/boilerpipe-read-only/boilerpipe-core',
							//detached: true,
						},
					function (me, data) {
						me.stdout += data.toString();
						xtext1=me.stdout;
						console.log("xtext1:"+xtext1);
					},
					  function (me,result) {
						me.exit = 1;
						console.log("me.result"+result);
						xtext=result;
						callback();
					}
					);
				}
				else if (m="r"){
					//extract readable content using node-readability
					var readability = require('node-readability');

					// uncoment the following line to print the debug info to console.
					 readability.debug(true);


					readability.read(orgText,
					function(err, read) {
					  var dom = read.getDocument();
					  var html = '<html><head><meta charset="utf-8"><title>'+dom.title+'</title></head><body><h1>'+read.getTitle()+'</h1>'+read.getContent()+'</body></html>';
					  xtext=html;
						console.log(xtext);
						callback();
					});
				}
			},
			//save extracted text to mongo
			function(callback){
				db.collection('xtraxt', function(err, collection) {
			        collection.update({'_id':requestId}, {ip:ip,url:u,orgText:orgText,xtext:xtext}, {safe:true}, function(err, result) {
			            if (err) {
			                console.log('Error updating doc: ' + err);
			                res.send({'error':'An error has occurred'});
			            } else {
			                console.log('' + result + ' document(s) updated');
							callback();
			            }
			        });
			    });
			},
		],function(err,result){
//			console.log("result:"+result);
			res.send({doc:orgText, xtext:xtext});
		});

		
	};
