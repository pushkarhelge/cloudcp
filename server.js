// using express JS
const express = require("express");
const jwt = require('jsonwebtoken');
const app = express();


require('dotenv').config()


// app.use(express.json());
// app.use(express.urlencoded({extended: false}))

// express formidable is used to parse the form data values
var formidable = require("express-formidable");
app.use(formidable());

// use mongo DB as database
var mongodb = require("mongodb");
var mongoClient = mongodb.MongoClient;

// the unique ID for each mongo DB document
var ObjectId = mongodb.ObjectId;

// receiving http requests
var httpObj = require("http");
var http = httpObj.createServer(app);

// to encrypt/decrypt passwords
var bcrypt = require("bcrypt");

// to store files
var fileSystem = require("fs");

// to start the session
var session = require("express-session");
app.use(session({
    secret: 'secret key',
    resave: false,
    saveUninitialized: false
}));

// define the publically accessible folders
app.use("/public/css", express.static(__dirname + "/public/css"));
app.use("/public/js", express.static(__dirname + "/public/js"));
app.use("/public/img", express.static(__dirname + "/public/img"));
app.use("/public/font-awesome-4.7.0", express.static(__dirname + "/public/font-awesome-4.7.0"));
app.use("/public/fonts", express.static(__dirname + "/public/fonts"));

// using EJS as templating engine
app.set("view engine", "ejs");

// main URL of website
var mainURL = "http://localhost:3000";
// var mainURL = "https://filesharecp.azurewebsites.net";

port = process.env.PORT;

// global database object
var database = null;

// app middleware to attach main URL and user object with each request
app.use(function (request, result, next) {
    request.mainURL = mainURL;
    request.isLogin = (typeof request.session.user !== "undefined");
    request.user = request.session.user;

    // continue the request
    next();
});

// Import nodemailer to send email
const nodemailer = require('nodemailer');

// Generate a unique token for password reset
function generateToken() {
    const token = Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
    return token;
}

// recursive function to get the file from uploaded
function recursiveGetFile(files, _id) {
    var singleFile = null;

    for (var a = 0; a < files.length; a++) {
        const file = files[a];

        // return if file type is not folder and ID is found
        if (file.type != "folder") {
            if (file._id == _id) {
                return file;
            }
        }

        // if it is a folder and have files, then do the recursion
        if (file.type == "folder" && file.files.length > 0) {
            singleFile = recursiveGetFile(file.files, _id);
            // return the file if found in sub-folders
            if (singleFile != null) {
                return singleFile;
            }
        }
    }
}

// function to add new uploaded object and return the updated array
function getUpdatedArray(arr, _id, uploadedObj) {
    for (var a = 0; a < arr.length; a++) {
        // push in files array if type is folder and ID is found
        if (arr[a].type == "folder") {
            if (arr[a]._id == _id) {
                arr[a].files.push(uploadedObj);
                arr[a]._id = ObjectId(arr[a]._id);
            }

            // if it has files, then do the recursion
            if (arr[a].files.length > 0) {
                arr[a]._id = ObjectId(arr[a]._id);
                getUpdatedArray(arr[a].files, _id, uploadedObj);
            }
        }
    }

    return arr;
}

// recursive function to remove the file and return the updated array
function removeFileReturnUpdated(arr, _id) {
    for (var a = 0; a < arr.length; a++) {
        if (arr[a].type != "folder" && arr[a]._id == _id) {
            // remove the file from uploads folder
            try {
                fileSystem.unlinkSync(arr[a].filePath);
            } catch (exp) {
                // 
            }
            // remove the file from array
            arr.splice(a, 1);
            break;
        }

        // do the recursion if it has sub-folders
        if (arr[a].type == "folder" && arr[a].files.length > 0) {
            arr[a]._id = ObjectId(arr[a]._id);
            removeFileReturnUpdated(arr[a].files, _id);
        }
    }

    return arr;
}

// recursive function to search uploaded files
function recursiveSearch(files, query) {
    var singleFile = null;

    for (var a = 0; a < files.length; a++) {
        const file = files[a];

        if (file.type == "folder") {
            // search folder case-insensitive
            if (file.folderName.toLowerCase().search(query.toLowerCase()) > -1) {
                return file;
            }

            if (file.files.length > 0) {
                singleFile = recursiveSearch(file.files, query);
                if (singleFile != null) {
                    // need parent folder in case of files
                    if (singleFile.type != "folder") {
                        singleFile.parent = file;
                    }
                    return singleFile;
                }
            }
        } else {
            if (file.name.toLowerCase().search(query.toLowerCase()) > -1) {
                return file;
            }
        }
    }
}

// recursive function to search shared files
function recursiveSearchShared(files, query) {
    var singleFile = null;

    for (var a = 0; a < files.length; a++) {
        var file = (typeof files[a].file === "undefined") ? files[a] : files[a].file;

        if (file.type == "folder") {
            if (file.folderName.toLowerCase().search(query.toLowerCase()) > -1) {
                return file;
            }

            if (file.files.length > 0) {
                singleFile = recursiveSearchShared(file.files, query);
                if (singleFile != null) {
                    if (singleFile.type != "folder") {
                        singleFile.parent = file;
                    }
                    return singleFile;
                }
            }
        } else {
            if (file.name.toLowerCase().search(query.toLowerCase()) > -1) {
                return file;
            }
        }
    }
}


// recursive function to get the folder from uploaded files

function recursiveGetFolder(files,_id){
    var singleFile = null;

    for(var a=0;a<files.length;a++){
        const file = files[a];

        // return if file type is folder and ID is found
        if(file.type == "folder"){
            if(file._id == _id){
                return file;
            }

            // if it has files, then do recursion
            if(file.files.length>0){
                singleFile = recursiveGetFolder(file.files, _id);
                // return the file if found in sub-folders
                if(singleFile!=null){
                    return singleFile;
                }
            }
        }
    }
}


// start the http server
http.listen(port, function () {
    console.log("Server started at " + mainURL);

    // connect with mongo DB server

    // process.env.MONGO_URL
    // mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true })
    //     .then(() => {
    //         console.log("Database Connected!")
    //     })
    //     .catch((err) => {
    //         console.log(err);
    //     })


    mongoClient.connect(process.env.MONGO_URL, {
        useUnifiedTopology: true
    }, function (error, client) {

        // connect database (it will automatically create the database if not exists)
        database = client.db("file_transfer");
        console.log("Database connected.");

        app.get("/pro-versions", function (request, result) {
            result.render("proVersions", {
                "request": request
            });
        });

        app.get("/Admin", async function (request, result) {
            // render an HTML page with number of pages, and posts data
            result.render("Admin", {
                request: request
            });
        });



        // search files or folders
        app.get("/Search", async function (request, result) {
            const search = request.query.search;

            if (request.session.user) {
                var user = await database.collection("users").findOne({
                    "_id": ObjectId(request.session.user._id)
                });
                var fileUploaded = await recursiveSearch(user.uploaded, search);
                var fileShared = await recursiveSearchShared(user.sharedWithMe, search);

                // check if file is uploaded or shared with user
                if (fileUploaded == null && fileShared == null) {
                    request.status = "error";
                    request.message = "File/folder '" + search + "' is neither uploaded nor shared with you.";

                    result.render("Search", {
                        "request": request
                    });
                    return false;
                }

                var file = (fileUploaded == null) ? fileShared : fileUploaded;
                file.isShared = (fileUploaded == null);
                result.render("Search", {
                    "request": request,
                    "file": file
                });

                return false;
            }

            result.redirect("/Login");
        });

        app.get("/Blog", async function (request, result) {
            // render an HTML page with number of pages, and posts data
            result.render("Blog", {
                request: request
            });
        });

        // get all files shared with logged-in user
        app.get("/SharedWithMe/:_id?", async function (request, result) {
            const currentUser = request.user;
            const fileId = request.params._id;
            let sharedFiles = [];

            if (fileId) {
                // get shared file by id
                const sharedFile = await database.collection('shared_files').findOne({ _id: ObjectId(fileId) });
                sharedFiles.push(sharedFile);
            } else {
                // get all shared files for current user
                sharedFiles = await database.collection('shared_files').find({ shared_with: currentUser.email }).toArray();
            }

            result.render("SharedWithMe", {
                "request": request,
                "sharedFiles": sharedFiles
            });
        });

        // handle form submission for sharing file with another user via email
        app.post("/SharedWithMe/:fileId/share", async function (request, result) {
            const currentUser = request.user;
            const fileId = request.params.fileId;
            const { email } = request.body;

            try {
                // Find the file being shared
                const file = await database.collection('files').findOne({ _id: ObjectId(fileId), owner: currentUser.email });
                if (!file) {
                    // If the file is not found or the user does not own it, return an error response
                    return result.status(400).json({ message: "File not found or you do not have permission to share it" });
                }

                // Check if the user being shared with exists
                const user = await database.collection('users').findOne({ email });
                if (!user) {
                    // If the user being shared with does not exist, return an error response
                    return result.status(400).json({ message: "User not found" });
                }

                // Check if the user being shared with is the owner of the file
                if (user.email === file.owner) {
                    return result.status(400).json({ message: "You cannot share a file with its owner" });
                }

                // Create a new shared file record
                const sharedFile = {
                    file_id: file._id,
                    shared_by: currentUser.email,
                    shared_with: user.email,
                    shared_at: new Date()
                };
                await database.collection('shared_files').insertOne(sharedFile);

                // Send success response
                result.status(200).json({ message: "File shared successfully" });
            } catch (error) {
                // If an error occurs, return an error response
                console.error(error);
                result.status(500).json({ message: "Internal server error" });
            }
        });

        // handle form submission to share a file
        app.post("/shared-file", async function (request, response) {
            try {
                const fileId = req.fields.fileId;
                const email = req.fields.email;

                // check if file exists
                const file = await File.findById(fileId);
                if (!file) {
                    return response.status(404).send("File not found");
                }

                // check if user exists
                const user = await User.findOne({ email: email });
                if (!user) {
                    return response.status(404).send("User not found");
                }

                // check if user already has access to the file
                if (file.sharedWith.includes(user._id)) {
                    return response.status(400).send("File already shared with user");
                }

                // add user to sharedWith array
                file.sharedWith.push(user._id);
                await file.save();

                response.redirect(`/SharedWithMe/${user._id}`);
            } catch (error) {
                console.error(error);
                response.status(500).send("Internal server error");
            }
        });



        app.post("/DeleteLink", async function (request, result) {

            const _id = request.fields._id;

            if (request.session.user) {
                var link = await database.collection("public_links").findOne({
                    $and: [{
                        "uploadedBy._id": ObjectId(request.session.user._id)
                    }, {
                        "_id": ObjectId(_id)
                    }]
                });

                if (link == null) {
                    request.session.status = "error";
                    request.session.message = "Link does not exists.";

                    const backURL = request.header("Referer") || "/";
                    result.redirect(backURL);
                    return false;
                }

                await database.collection("public_links").deleteOne({
                    $and: [{
                        "uploadedBy._id": ObjectId(request.session.user._id)
                    }, {
                        "_id": ObjectId(_id)
                    }]
                });

                request.session.status = "success";
                request.session.message = "Link has been deleted.";

                const backURL = request.header("Referer") || "/";
                result.redirect(backURL);
                return false;
            }

            result.redirect("/Login");
        });

        app.get("/MySharedLinks", async function (request, result) {
            if (request.session.user) {
                var links = await database.collection("public_links").find({
                    "uploadedBy._id": ObjectId(request.session.user._id)
                }).toArray();

                result.render("MySharedLinks", {
                    "request": request,
                    "links": links
                });
                return false;
            }

            result.redirect("/Login");
        });

        app.get("/SharedViaLink/:hash", async function (request, result) {
            const hash = request.params.hash;

            var link = await database.collection("public_links").findOne({
                "hash": hash
            });

            if (link == null) {
                request.session.status = "error";
                request.session.message = "Link expired.";

                result.render("SharedViaLink", {
                    "request": request
                });
                return false;
            }

            result.render("SharedViaLink", {
                "request": request,
                "link": link
            });
        });

        app.post("/ShareViaLink", async function (request, result) {
            const _id = request.fields._id;

            if (request.session.user) {
                var user = await database.collection("users").findOne({
                    "_id": ObjectId(request.session.user._id)
                });
                var file = await recursiveGetFile(user.uploaded, _id);

                if (file == null) {
                    request.session.status = "error";
                    request.session.message = "File does not exists";

                    const backURL = request.header("Referer") || "/";
                    result.redirect(backURL);
                    return false;
                }

                bcrypt.hash(file.name, 10, async function (error, hash) {
                    hash = hash.substring(10, 20);
                    const link = mainURL + "/SharedViaLink/" + hash;
                    await database.collection("public_links").insertOne({
                        "hash": hash,
                        "file": file,
                        "uploadedBy": {
                            "_id": user._id,
                            "name": user.name,
                            "email": user.email
                        },
                        "createdAt": new Date().getTime()
                    });

                    request.session.status = "success";
                    request.session.message = "Share link: " + link;

                    const backURL = request.header("Referer") || "/";
                    result.redirect(backURL);
                });

                return false;
            }

            result.redirect("/Login");
        });

        // delete uploaded file
        app.post("/DeleteFile", async function (request, result) {
            const _id = request.fields._id;

            if (request.session.user) {
                var user = await database.collection("users").findOne({
                    "_id": ObjectId(request.session.user._id)
                });

                var updatedArray = await removeFileReturnUpdated(user.uploaded, _id);
                for (var a = 0; a < updatedArray.length; a++) {
                    updatedArray[a]._id = ObjectId(updatedArray[a]._id);
                }

                await database.collection("users").updateOne({
                    "_id": ObjectId(request.session.user._id)
                }, {
                    $set: {
                        "uploaded": updatedArray
                    }
                });

                const backURL = request.header('Referer') || '/';
                result.redirect(backURL);
                return false;
            }

            result.redirect("/Login");
        });

        // download file
        app.post("/DownloadFile", async function (request, result) {
            const _id = request.fields._id;

            var link = await database.collection("public_links").findOne({
                "file._id": ObjectId(_id)
            });

            if (link != null) {
                fileSystem.readFile(link.file.filePath, function (error, data) {
                    // console.log(error);

                    result.json({
                        "status": "success",
                        "message": "Data has been fetched.",
                        "arrayBuffer": data,
                        "fileType": link.file.type,
                        // "file": mainURL + "/" + file.filePath,
                        "fileName": link.file.name
                    });
                });
                return false;
            }

            if (request.session.user) {

                var user = await database.collection("users").findOne({
                    "_id": ObjectId(request.session.user._id)
                });

                var fileUploaded = await recursiveGetFile(user.uploaded, _id);

                if (fileUploaded == null) {
                    result.json({
                        "status": "error",
                        "message": "File is neither uploaded nor shared with you."
                    });
                    return false;
                }

                var file = fileUploaded;

                fileSystem.readFile(file.filePath, function (error, data) {
                    // console.log(error);

                    result.json({
                        "status": "success",
                        "message": "Data has been fetched.",
                        "arrayBuffer": data,
                        "fileType": file.type,
                        // "file": mainURL + "/" + file.filePath,
                        "fileName": file.name
                    });
                });
                return false;
            }

            result.json({
                "status": "error",
                "message": "Please login to perform this action."
            });
            return false;
        });

        // view all files uploaded by logged-in user
        app.get("/MyUploads", async function (request, result) {
                    if (request.session.user) {

                        var user = await database.collection("users").findOne({
                            "_id": ObjectId(request.session.user._id)
                        });

                        var uploaded = user.uploaded;

                        result.render("MyUploads", {
                            "request": request,
                            "uploaded": uploaded
                        });
                        return false;
                    }

                    result.redirect("/Login");
                });

        // upload new file
        app.post("/UploadFile", async function (request, result) {
            if (request.session.user) {

                var user = await database.collection("users").findOne({
                    "_id": ObjectId(request.session.user._id)
                });

                if (request.files.file.size > 0) {

                    const _id = request.fields._id;

                    var uploadedObj = {
                        "_id": ObjectId(),
                        "size": request.files.file.size, // in bytes
                        "name": request.files.file.name,
                        "type": request.files.file.type,
                        "filePath": "",
                        "createdAt": new Date().getTime()
                    };

                    var filePath = "public/uploads/" + user.email + "/" + new Date().getTime() + "-" + request.files.file.name;
                    uploadedObj.filePath = filePath;

                    if (!fileSystem.existsSync("public/uploads/" + user.email)) {
                        fileSystem.mkdirSync("public/uploads/" + user.email);
                    }

                    // Read the file
                    fileSystem.readFile(request.files.file.path, function (err, data) {
                        if (err) throw err;
                        console.log('File read!');

                        // Write the file
                        fileSystem.writeFile(filePath, data, async function (err) {
                            if (err) throw err;
                            console.log('File written!');

                            await database.collection("users").updateOne({
                                "_id": ObjectId(request.session.user._id)
                            }, {
                                $push: {
                                    "uploaded": uploadedObj
                                }
                            });

                            request.session.status = "success";
                            request.session.message = "Upload Request Successfull!";

                            result.redirect("/MyUploads/" + _id);
                        });

                        // Delete the file
                        fileSystem.unlink(request.files.file.path, function (err) {
                            if (err) throw err;
                            console.log('File deleted!');
                        });
                    });

                } else {
                    request.status = "error";
                    request.message = "Please select valid image.";

                    result.render("MyUploads", {
                        "request": request
                    });
                }

                return false;
            }

            result.redirect("/Login");
        });

        // logout the user
        app.get("/Logout", function (request, result) {
            request.session.destroy();
            result.redirect("/");
        });  
          

        // show page to login
        app.get("/Login", function (request, result) {
            result.render("Login", {
                "request": request
            });
        });
        

        // authenticate the user
        app.post("/Login", async function (request, result) {
            var email = request.fields.email;
            var password = request.fields.password;

            var user = await database.collection("users").findOne({
                "email": email
            });

            if (user == null) {
                request.status = "error";
                request.message = "Email does not exist.";
                result.render("Login", {
                    "request": request
                });

                return false;
            }

            bcrypt.compare(password, user.password, function (error, isVerify) {
                if (isVerify) {
                    request.session.user = user;
                    result.redirect("/");

                    return false;
                }

                request.status = "error";
                request.message = "Password is not correct.";
                result.render("Login", {
                    "request": request
                });
            });
        });

        // register the user
        app.post("/Register", async function (request, result) {

            var name = request.fields.name;
            var email = request.fields.email;
            var password = request.fields.password;
            var reset_token = "";
            var isVerified = true;
            var verification_token = new Date().getTime();

            var user = await database.collection("users").findOne({
                "email": email
            });

            if (user == null) {
                bcrypt.hash(password, 10, async function (error, hash) {
                    await database.collection("users").insertOne({
                        "name": name,
                        "email": email,
                        "password": hash,
                        "reset_token": reset_token,
                        "uploaded": [],
                        "sharedWithMe": [],
                        "isVerified": isVerified,
                        "verification_token": verification_token
                    }, async function (error, data) {

                        request.status = "success";
                        request.message = "Signed up successfully. You can login now.";

                        result.render("Register", {
                            "request": request
                        });

                    });
                });
            } else {
                request.status = "error";
                request.message = "Email already exist.";

                result.render("Register", {
                    "request": request
                });
            }
        });

        // show page to do the registration
        app.get("/Register", function (request, result) {
            result.render("Register", {
                "request": request
            });
        });


        
        // new Forgot Password

        app.get("/ForgotPassword",function (request, result) {
            result.render("ForgotPassword",{
                "request":request
            });
        });

        app.post("/SendRecoveryLink", async function (request,result){
            const email = request.fields.email;

            console.log(email);

            // Check if email exists in the database
            const user = await database.collection('users').findOne({ email: email });



            if (user == null) {
                request.status = "error";
                request.message = "Email doesnot exists, Kindly Register First!"
                result.render('ForgotPassword', { 
                    "request" : request
                 });
                return false;
            }
            if (!user) {
                result.render('ForgotPassword', { error: 'Email not found' });
                return;
            }

            // Generate one-time password link
            // const reset_token = generateToken(); 
            const reset_token = new Date().getTime();
            const resetUrl = `${mainURL}/ResetPassword/${email}/${reset_token}`;

            // Update user's reset token in the database
            await database.collection('users').updateOne({ "email" : email }, { $set: { "reset_token": reset_token } });

            // Send password reset link to user's email
            const transporter = nodemailer.createTransport({

                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASSWORD
                }
            });

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'FileshareCP Password Reset',
                // text :"Please click the following link to rest your password :" +mainURL + "/ResetPassword/"+email+"/"+reset_token,
                html: `Please click <a href="${resetUrl     }">here</a> to reset your password.`
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log(error);
                } else {
                    console.log('Email sent: ' + info.response);
                }

                request.status = "success";
                request.message = "Email has been sent with the link to recover the password.";

                result.render('ForgotPassword', { 
                    "request" : request
                    // message: 'Password reset link has been sent to your email'
                });

            });            
        });


        app.get('/ResetPassword/:email/:reset_token', async function(request, result){

            const email = request.params.email;
            const reset_token = request.params.reset_token;

            const user = await database.collection("users").findOne({
                $and:[{
                    "email":email
                },{
                    "reset_token": parseInt(reset_token)
                }]
            });

            if(user == null){
                request.status = "error";
                request.message = "Link is Expired.";
                result.render("Error",{
                    "request": request
                });
                return false;
            }
            
            result.render('ResetPassword', { 
                "request": request,
                "email": email,
                "reset_token" : reset_token
            });
        });

        app.post("/ResetPassword", async function(request,result){
            const email = request.fields.email;
            const reset_token = request.fields.reset_token;

            const new_password = request.fields.new_password;
            const confirm_password = request.fields.confirm_password;

            if(new_password!=confirm_password){
                request.status = "error";
                request.message = "Password doesnot match."

                result.render("ResetPassword",{
                    "request" : request,
                    "email" : email,
                    "reset_token" : reset_token
                });
                return false;
            }

            const user = await database.collection("users").findOne({
                $and: [{
                    "email":email
                },{
                    "reset_token": parseInt(reset_token)
                }]
            });

            if(user == null){
                request.status = "error";
                request.message = "Link is Expired.";

                result.render("ResetPassword",{
                    "request": request,
                    "email" : email,
                    "reset_token" : reset_token
                });
                return false;
            }

            bcrypt.hash(new_password,10,async function(error,hash){
                await database.collection("users").findOneAndUpdate({
                    $and: [{
                        "email":email,
                    },{
                        "reset_token": parseInt(reset_token)
                    }]  
                }, {
                    $set : {
                        "reset_token": "",
                        "password" : hash
                    }
                });
                console.log("Password has been reset sucessfully. Please try login again");
                request.status = "success";
                request.message = "Password has been reset sucessfully. Please try login again"
                
                result.render("Login",{
                    "request": request
                });
            });

        });

        // home page
        app.get("/", function (request, result) {
            result.render("index", {
                "request": request
            });
        });
    });
});