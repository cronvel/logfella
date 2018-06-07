/*
	Logfella

	Copyright (c) 2015 - 2018 Cédric Ronvel

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

"use strict" ;



if ( process.browser ) { return ; }



var Logfella = require( '../lib/Logfella.js' ) ;
var Promise = require( 'seventh' ) ;





			/* Tests */



describe( "Logfella" , function() {
	
	it( "single test" , function() {
		
		var logger = Logfella.create() ;
		
		logger.configure( {
			minLevel: 'trace' ,
			defaultDomain: 'default-domain'
		} ) ;
		
		logger.addTransport( 'console' , { minLevel: 'trace' , output: process.stderr , includeIdMeta: true } ) ;
		logger.addTransport( 'scatteredFiles' , { minLevel: 'trace' , color: true , path: __dirname + '/log' } ) ;
		logger.addTransport( 'file' , { minLevel: 'trace' , color: true , path: __dirname + '/log/app.log' } ) ;
		
		logger.debug( null , 'Hello ^RWorld^:!' ) ;
		logger.debug( null , 'Hello ^R%s^:!', 'world' ) ;
		logger.info( 'my-domain' , 'Hello %s!', 'my-domain' ) ;
	} ) ;
	
	it( "color, no-color" , function() {
		
		var logger = Logfella.create() ;
		
		logger.configure( {
			minLevel: 'trace' ,
			defaultDomain: 'default-domain'
		} ) ;
		
		logger.addTransport( 'console' , { minLevel: 'trace' , color: false , output: process.stderr , includeIdMeta: true } ) ;
		logger.addTransport( 'scatteredFiles' , { minLevel: 'trace' , color: true , path: __dirname + '/log' } ) ;
		logger.addTransport( 'file' , { minLevel: 'trace' , color: false , path: __dirname + '/log/app.log' } ) ;
		
		logger.debug( null , 'Hello ^R%s^:!', 'world' ) ;
		logger.info( 'my-domain' , 'Hello ^G%s^:!', 'my-domain' ) ;
	} ) ;
	
	it( "including a code and meta" , function() {
		
		var logger = Logfella.create() ;
		
		logger.configure( {
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
	
	it( "misc tests" , () => {
		
		var logger = Logfella.create() ;
		var teaTimeLogger = logger.use( 'tea-time' ) ;
		
		logger.configure( {
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
		
		teaTimeLogger.log( 'warning' , 'This is the Tea Time logger' ) ;
		teaTimeLogger.info( 'This is the Tea Time logger x2' ) ;
		logger.debug( null , 'Inspector: %I' , { some: 'value' , another: 'string' } ) ;
		teaTimeLogger.debug( 'Inspector: %I' , { some: 'value' , another: 'string' } ) ;
		
		return Promise.all( [
			logger.trace( 'my-domain' , 'Blah' ) ,
			logger.debug( 'my-domain' , 'Blah' ) ,
			logger.verbose( 'my-domain' , 'Blah' ) ,
			logger.info( 'my-domain' , 'Blah' ) ,
			logger.warning( 'my-domain' , 'Blah' ) ,
			logger.error( 'my-domain' , 'Blah: %s' , 'formated' ) ,
			logger.fatal( 'my-domain' , 'Blah' )
		] ) ;
	} ) ;
	
	it( "full setup" , () => {
		
		var logger = Logfella.create( {
			minLevel: 'trace' ,
			defaultDomain: 'default-domain' ,
			transports: [
				{ type: 'console' , color: true , output: process.stderr }
			]
		} ) ;
		
		var teaTimeLogger = logger.use( 'tea-time' ) ;
		
		logger.info( null , 'call me later' ) ;
		logger.info( null , 'some (%i) formated %s' , 1 , 'output' ) ;
		logger.log( 5 , null , 'using integer' ) ;
		
		teaTimeLogger.log( 'warning' , 'This is the Tea Time logger' ) ;
		teaTimeLogger.info( 'This is the Tea Time logger x2' ) ;
		logger.debug( null , 'Inspector: %I' , { some: 'value' , another: 'string' } ) ;
		teaTimeLogger.debug( 'Inspector: %I' , { some: 'value' , another: 'string' } ) ;
		
		return Promise.all( [
			logger.trace( 'my-domain' , 'Blah' ) ,
			logger.debug( 'my-domain' , 'Blah' ) ,
			logger.verbose( 'my-domain' , 'Blah' ) ,
			logger.info( 'my-domain' , 'Blah' ) ,
			logger.warning( 'my-domain' , 'Blah' ) ,
			logger.error( 'my-domain' , 'Blah: %s' , 'formated' ) ,
			logger.fatal( 'my-domain' , 'Blah' )
		] ) ;
	} ) ;
	
	it( "full setup on global" , () => {
		
		var logger = Logfella.global ;
		
		logger.configure( {
			minLevel: 'trace' ,
			defaultDomain: 'default-domain' ,
			transports: [
				{ type: 'console' , color: true , output: process.stderr }
			]
		} ) ;
		
		var teaTimeLogger = logger.use( 'tea-time' ) ;
		
		logger.info( null , 'call me later' ) ;
		logger.info( null , 'some (%i) formated %s' , 1 , 'output' ) ;
		logger.log( 5 , null , 'using integer' ) ;
		
		teaTimeLogger.log( 'warning' , 'This is the Tea Time logger' ) ;
		teaTimeLogger.info( 'This is the Tea Time logger x2' ) ;
		logger.debug( null , 'Inspector: %I' , { some: 'value' , another: 'string' } ) ;
		teaTimeLogger.debug( 'Inspector: %I' , { some: 'value' , another: 'string' } ) ;
		
		return Promise.all( [
			logger.trace( 'my-domain' , 'Blah' ) ,
			logger.debug( 'my-domain' , 'Blah' ) ,
			logger.verbose( 'my-domain' , 'Blah' ) ,
			logger.info( 'my-domain' , 'Blah' ) ,
			logger.warning( 'my-domain' , 'Blah' ) ,
			logger.error( 'my-domain' , 'Blah: %s' , 'formated' ) ,
			logger.fatal( 'my-domain' , 'Blah' )
		] ) ;
	} ) ;
	
	it( "errors" , function() {
		
		var logger = Logfella.create() ;
		var teaTimeLogger = logger.use( 'tea-time' ) ;
		
		logger.configure( {
			minLevel: 'trace' ,
			defaultDomain: 'default-domain'
		} ) ;
		
		logger.addTransport( 'console' , { minLevel: 'trace' , output: process.stderr } ) ;
		logger.error( null , new Error( 'Something bad happens' ) ) ;
	} ) ;
	
	it( "variable inspection" , function() {
		
		var logger = Logfella.create() ;
		var teaTimeLogger = logger.use( 'tea-time' ) ;
		
		logger.configure( {
			minLevel: 'trace' ,
			defaultDomain: 'default-domain'
		} ) ;
		
		logger.addTransport( 'console' , { minLevel: 'trace' , output: process.stderr } ) ;
		logger.debug( null , { one: 1 , two: 'TWO!' } ) ;
	} ) ;
	
	it( "format color" , function() {
		
		var logger = Logfella.create() ;
		
		logger.configure( {
			minLevel: 'trace' ,
			defaultDomain: 'default-domain'
		} ) ;
		
		logger.addTransport( 'console' , { minLevel: 'trace' , output: process.stderr } ) ;
		
		logger.info( null , 'some format inspect %I' , { one: 1 , two: 'TWO!' } ) ;
		logger.error( null , 'some error %E' , new Error( 'Something bad happens' ) ) ;
	} ) ;
	
	it( "monitoring" , function() {
		
		var logger = Logfella.create() ;
		
		logger.configure( {
			minLevel: 'trace' ,
			defaultDomain: 'default-domain'
		} ) ;
		
		logger.mon.bob = 123 ;
		
		logger.addTransport( 'console' , { minLevel: 'trace' , role: 'mon' , output: process.stderr } ) ;
		
		logger.warning( null , 'warning!' ) ;
		logger.error( null , 'some error %E' , new Error( 'Something bad happens' ) ) ;
		logger.fatal( null , 'some fatal error %E' , new Error( 'Something really bad happens' ) ) ;
		logger.info( null , { mon: { "+bob": 5 } } , 'This update monitoring' ) ;
		
		expect( logger.mon ).to.equal( { warnings: 1 , errors: 2 , bob: 128 } ) ;
		logger.info( null , 'Monitoring: %I' , logger.mon ) ;
		
		logger.monFrame() ;
	} ) ;
} ) ;

