#!/usr/bin/env node
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




var Logfella = require( '../lib/Logfella.js' ) ;
var async = require( 'async-kit' ) ;
//var expect = require( 'expect.js' ) ;





			/* Tests */



describe( "NetServer Transport" , function() {
	
	it( "simple test" , function( done ) {
		
		this.timeout( 10000 ) ;
		
		var logger = Logfella.create() ;
		var count = 0 ;
		
		logger.setGlobalConfig( {
			minLevel: 'trace' ,
			defaultDomain: 'default-domain'
		} ) ;
		
		logger.addTransport( 'console' , { minLevel: 'trace' , output: process.stderr } ) ;
		logger.addTransport( 'netServer' , { minLevel: 'trace' , listen: 1234 } ) ;
		
		logger.logTransports[ 1 ].server.on( 'connection' , function() {
			
			count ++ ;
			
			if ( count >= 2 )
			{
				logger.warning( 'storage' , 'gloups' , 'We are running out of storage! Only %iMB left' , 139 ) ;
				logger.info( 'idle' , { some: 'meta' , few: 'data' , somethingElse: 4 } , 'Youpla boum!' ) ;
				
				setTimeout( done , 30 ) ;
			}
		} ) ;
	} ) ;
	
} ) ;



