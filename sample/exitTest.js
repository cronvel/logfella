#!/usr/bin/env node
/*
	Logfella

	Copyright (c) 2015 - 2019 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;

var logger = require( '../lib/Logfella.js' ).global.use( 'main' ) ;
var Promise = require( 'seventh' ) ;



process.on( 'beforeExit' , function() {
	logger.info( 'Nothing to do, about to end the process...' ) ;
} ) ;



logger.installExitHandlers() ;



//*
process.on( 'uncaughtException' , function( error ) {
	logger.info( 'do something about that exception...' ) ;
	//throw error ;
	Promise.asyncExit( 2 ) ;
} ) ;
//*/

//throw new Error( 'Something bad happens' ) ;
setTimeout( function() { throw new Error( 'Something bad asynchronously happens' ) ; } , 100 ) ;
setTimeout( function() { logger.info( 'Some scheduled task...' ) ; } , 500 ) ;

//process.

//process.exit( 2 ) ;




