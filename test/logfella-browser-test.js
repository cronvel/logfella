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



if ( ! process.browser ) { return ; }



var Logfella = require( '../lib/Logfella.js' ) ;



			/* Tests */



describe( "Logfella" , function() {
	
	it( "single test" , function() {
		
		var logger = Logfella.create() ;
		
		logger.setGlobalConfig( {
			minLevel: 'trace' ,
			defaultDomain: 'default-domain'
		} ) ;
		
		logger.addTransport( 'browserConsole' , { minLevel: 'trace' , includeIdMeta: true } ) ;
		logger.info( 'my-domain' , 'Hello %s!', 'my-domain' ) ;
	} ) ;
	
	it( "including a code and meta" , function() {
		
		var logger = Logfella.create() ;
		
		logger.setGlobalConfig( {
			minLevel: 'trace' ,
			defaultDomain: 'default-domain'
		} ) ;
		
		logger.addTransport( 'browserConsole' , { minLevel: 'trace' , includeIdMeta: true } ) ;
		
		logger.error( null , 'ENOENT' , "File '%s' not found", 'toto.txt' ) ;
		logger.warning( null , { code: 'ENOENT' , file: 'toto.txt' } , "File '%s' not found", 'toto.txt' ) ;
		logger.info( 'my-domain' , 'Blah: %s' , 'formated' ) ;
	} ) ;
	
	it( "errors" , function() {
		
		var logger = Logfella.create() ;
		var mochaLogger = logger.use( 'mocha' ) ;
		
		logger.setGlobalConfig( {
			minLevel: 'trace' ,
			defaultDomain: 'default-domain'
		} ) ;
		
		logger.addTransport( 'browserConsole' , { minLevel: 'trace' } ) ;
		logger.error( null , new Error( 'Something bad happens' ) ) ;
	} ) ;
	
	it( "variable inspection" , function() {
		
		var logger = Logfella.create() ;
		var mochaLogger = logger.use( 'mocha' ) ;
		
		logger.setGlobalConfig( {
			minLevel: 'trace' ,
			defaultDomain: 'default-domain'
		} ) ;
		
		logger.addTransport( 'browserConsole' , { minLevel: 'trace' } ) ;
		logger.debug( null , { one: 1 , two: 'TWO!' } ) ;
	} ) ;
	
	it( "format color" , function() {
		
		var logger = Logfella.create() ;
		
		logger.setGlobalConfig( {
			minLevel: 'trace' ,
			defaultDomain: 'default-domain'
		} ) ;
		
		logger.addTransport( 'browserConsole' , { minLevel: 'trace' } ) ;
		
		logger.info( null , 'some format inspect %I' , { one: 1 , two: 'TWO!' } ) ;
		logger.error( null , 'some error %E' , new Error( 'Something bad happens' ) ) ;
	} ) ;
	
} ) ;



