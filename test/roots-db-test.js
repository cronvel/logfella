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




var Logfella = require( '../lib/Logfella.js' ) ;
var async = require( 'async-kit' ) ;
//var expect = require( 'expect.js' ) ;

// Do not run the test if roots-db is not installed
try { require( 'roots-db' ) ; } catch ( error ) { return ; }





			/* Tests */



describe( "Roots DB Transport" , function() {
	
	it( "simple test" , function( done ) {
		
		var logger = Logfella.create() ;
		
		logger.setGlobalConfig( {
			minLevel: 'trace' ,
			defaultDomain: 'default-domain'
		} ) ;
		
		logger.addTransport( 'console' , { minLevel: 'trace' , output: process.stderr } ) ;
		logger.addTransport( 'rootsDb' , { minLevel: 'trace' , url: 'mongodb://localhost:27017/logger-kit/logs' } ) ;
		
		logger.warning( 'storage' , 'gloups' , 'We are running out of storage! Only %iMB left' , 139 ) ;
		
		// The last, with callback...
		logger.info( 'idle' , { some: 'meta' , few: 'data' , somethingElse: 4 } , 'Youpla boum!' , done ) ;
	} ) ;
	
} ) ;



