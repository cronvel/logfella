/*
	The Cedric's Swiss Knife (CSK) - CSK logger toolbox

	Copyright (c) 2015 Cédric Ronvel 
	
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

/* global describe, it */



/*
	TODO:
	
	Async.EventEmitter
	Async.Plan:
		clone()
		execAction()
		execMap() & exec()
		export()
	Event:
		progress
		finish
*/



var Logger = require( '../lib/Logger.js' ) ;
var async = require( 'async-kit' ) ;
//var expect = require( 'expect.js' ) ;





			/* Tests */



describe( "logger" , function() {
	
	it( "should blah" , function( done ) {
		
		console.log() ;
		var logger = Logger.create() ;
		var mochaLogger = logger.use( 'mocha' ) ;
		
		logger.setGlobalConfig( {
			minLevel: 'trace' ,
			defaultDomain: 'default-domain'
		} ) ;
		
		//logger.addTransport( 'console' , 'info' , { color: true } ) ;
		logger.addTransport( 'console' , { minLevel: 'trace' , output: process.stderr } ) ;
		logger.addTransport( 'files' , { minLevel: 'trace' , color: true , path: __dirname + '/log' } ) ;
		
		logger.info( null , 'call me later' ) ;
		logger.info( null , 'some (%i) formated %s' , 1 , 'output' ) ;
		logger.log( 5 , null , 'using integer' ) ;
		
		mochaLogger.log( 'warning' , 'This is the mocha logger' ) ;
		mochaLogger.info( 'This is the mocha logger x2' ) ;
		logger.debug( null , 'Inspector: %I' , { some: 'value' , another: 'string' } ) ;
		mochaLogger.debug( 'Inspector: %I' , { some: 'value' , another: 'string' } ) ;
		
		async.do( [
			[ logger.trace.bind( logger ) , 'my-domain' , 'Blah' ] ,
			[ logger.debug.bind( logger ) , 'my-domain' , 'Blah' ] ,
			[ logger.verbose.bind( logger ) , 'my-domain' , 'Blah' ] ,
			[ logger.info.bind( logger ) , 'my-domain' , 'Blah' ] ,
			[ logger.warning.bind( logger ) , 'my-domain' , 'Blah' ] ,
			[ logger.error.bind( logger ) , 'my-domain' , 'Blah: %s' , 'formated' ] ,
			[ logger.fatal.bind( logger ) , 'my-domain' , 'Blah' ]
		] )
		.exec( done ) ;
	} ) ;
} ) ;



