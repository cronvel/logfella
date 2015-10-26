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
		
		logger.setDefaultDomain( 'default-domain' ) ;
		logger.setGlobalLevel( 'trace' ) ;
		
		//logger.addTransport( 'console' , 'info' , { color: true } ) ;
		logger.addTransport( 'console' , 'info' , { output: process.stderr } ) ;
		logger.addTransport( 'files' , 'trace' , { color: true , path: __dirname + '/log' } ) ;
		
		logger.info( null , 'call me later' ) ;
		logger.info( null , 'some (%i) formated %s' , 1 , 'output' ) ;
		
		async.do( [
			[ logger.trace , 'mocha' , 'Blah' ] ,
			[ logger.debug , 'mocha' , 'Blah' ] ,
			[ logger.verbose , 'mocha' , 'Blah' ] ,
			[ logger.info , 'mocha' , 'Blah' ] ,
			[ logger.warning , 'mocha' , 'Blah' ] ,
			[ logger.error , 'mocha' , 'Blah: %s' , 'formated' ] ,
			[ logger.fatal , 'mocha' , 'Blah' ]
		] )
		.exec( done ) ;
	} ) ;
} ) ;



