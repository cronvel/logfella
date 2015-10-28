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




var Logger = require( '../lib/Logger.js' ) ;
var async = require( 'async-kit' ) ;
//var expect = require( 'expect.js' ) ;





			/* Tests */



describe( "Logger" , function() {
	
	it( "single test" , function() {
		
		var logger = Logger.create() ;
		
		logger.setGlobalConfig( {
			minLevel: 'trace' ,
			defaultDomain: 'default-domain'
		} ) ;
		
		logger.addTransport( 'console' , { minLevel: 'trace' , output: process.stderr , includeIdMeta: true } ) ;
		logger.addTransport( 'scatteredFiles' , { minLevel: 'trace' , color: true , path: __dirname + '/log' } ) ;
		logger.addTransport( 'file' , { minLevel: 'trace' , color: true , path: __dirname + '/log/app.log' } ) ;
		
		logger.debug( null , 'Hello %s!', 'world' ) ;
		logger.info( 'my-domain' , 'Hello %s!', 'my-domain' ) ;
	} ) ;
	
	it( "including a code and meta" , function() {
		
		var logger = Logger.create() ;
		
		logger.setGlobalConfig( {
			minLevel: 'trace' ,
			defaultDomain: 'default-domain'
		} ) ;
		
		logger.addTransport( 'console' , { minLevel: 'trace' , output: process.stderr } ) ;
		logger.addTransport( 'scatteredFiles' , { minLevel: 'trace' , color: true , path: __dirname + '/log' } ) ;
		logger.addTransport( 'file' , { minLevel: 'trace' , color: true , path: __dirname + '/log/app.log' } ) ;
		
		logger.error( null , 'ENOENT' , "File '%s' not found", 'toto.txt' ) ;
		logger.warning( null , { code: 'ENOENT' , file: 'toto.txt' } , "File '%s' not found", 'toto.txt' ) ;
		logger.info( 'my-domain' , 'Blah: %s' , 'formated' ) ;
	} ) ;
	
	it( "misc tests" , function( done ) {
		
		var logger = Logger.create() ;
		var mochaLogger = logger.use( 'mocha' ) ;
		
		logger.setGlobalConfig( {
			minLevel: 'trace' ,
			defaultDomain: 'default-domain'
		} ) ;
		
		//logger.addTransport( 'console' , 'info' , { color: true } ) ;
		logger.addTransport( 'console' , { minLevel: 'trace' , output: process.stderr } ) ;
		logger.addTransport( 'scatteredFiles' , { minLevel: 'trace' , color: true , path: __dirname + '/log' } ) ;
		logger.addTransport( 'file' , { minLevel: 'trace' , color: true , path: __dirname + '/log/app.log' } ) ;
		
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
	
	it( "full setup" , function( done ) {
		
		var logger = Logger.create( {
			minLevel: 'trace' ,
			defaultDomain: 'default-domain' ,
			transports: [
				{ type: 'console' , color: true , output: process.stderr }
			]
		} ) ;
		
		var mochaLogger = logger.use( 'mocha' ) ;
		
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
	
	it( "full setup on global" , function( done ) {
		
		var logger = Logger.global ;
		
		logger.setGlobalConfig( {
			minLevel: 'trace' ,
			defaultDomain: 'default-domain' ,
			transports: [
				{ type: 'console' , color: true , output: process.stderr }
			]
		} ) ;
		
		var mochaLogger = logger.use( 'mocha' ) ;
		
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
	
	it( "errors" , function() {
		
		var logger = Logger.create() ;
		var mochaLogger = logger.use( 'mocha' ) ;
		
		logger.setGlobalConfig( {
			minLevel: 'trace' ,
			defaultDomain: 'default-domain'
		} ) ;
		
		logger.addTransport( 'console' , { minLevel: 'trace' , output: process.stderr } ) ;
		logger.error( null , new Error( 'Something bad happens' ) ) ;
	} ) ;
	
	it( "variable inspection" , function() {
		
		var logger = Logger.create() ;
		var mochaLogger = logger.use( 'mocha' ) ;
		
		logger.setGlobalConfig( {
			minLevel: 'trace' ,
			defaultDomain: 'default-domain'
		} ) ;
		
		logger.addTransport( 'console' , { minLevel: 'trace' , output: process.stderr } ) ;
		logger.debug( null , { one: 1 , two: 'TWO!' } ) ;
	} ) ;
	
	it( "format color" , function() {
		
		var logger = Logger.create() ;
		
		logger.setGlobalConfig( {
			minLevel: 'trace' ,
			defaultDomain: 'default-domain'
		} ) ;
		
		logger.addTransport( 'console' , { minLevel: 'trace' , output: process.stderr } ) ;
		
		logger.info( null , 'some format inspect %I' , { one: 1 , two: 'TWO!' } ) ;
		logger.error( null , 'some error %E' , new Error( 'Something bad happens' ) ) ;
	} ) ;
	
} ) ;



