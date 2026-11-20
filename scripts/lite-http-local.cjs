'use strict';
// Local TCP adapter for hosts where the Functions Emulator cannot create Unix sockets.
// Authentication, data and object storage still use the Firebase emulators.
const path=require('node:path'),{createRequire}=require('node:module');
const fromFunctions=createRequire(path.resolve(__dirname,'../functions-lite/index.js'));
const express=fromFunctions('express');
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8087'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9097')throw Error('Isolated demo emulators required');
Object.assign(process.env,{GCLOUD_PROJECT:'demo-hub-lite',FUNCTIONS_EMULATOR:'true',STORAGE_EMULATOR_HOST:'http://127.0.0.1:9197',FIREBASE_STORAGE_EMULATOR_HOST:'127.0.0.1:9197'});
const {hubLiteApi}=fromFunctions('./index');
const app=express();app.disable('x-powered-by');app.use(express.json({limit:'8mb'}));
app.use('/api',hubLiteApi);app.use(express.static(path.resolve(__dirname,'../dist-lite'),{maxAge:0}));
app.listen(5018,'127.0.0.1',()=>console.log('Local HUB HTTP adapter ready on loopback.'));
