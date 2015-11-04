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



var Logfella = require( '../lib/Logfella.js' ) ;
var log = Logfella.global.use( 'tests' ) ;

var async = require( 'async-kit' ) ;


var count = 0 ;

log.setGlobalConfig( {
	minLevel: 'trace' ,
	defaultDomain: 'default-domain' ,
	monPeriod: 1000
} ) ;

log.installExitHandlers() ;

log.removeAllTransports() ;
log.addTransport( 'console' , { minLevel: 'trace' , output: process.stderr } ) ;
log.addTransport( 'netServer' , { role: 'mon' , minLevel: 'trace' , monitoring: true , listen: 1234 } ) ;

log.monTransports[ 0 ].server.on( 'connection' , function( socket ) {
	
	var id = ++ count ;
	
	log.info( { mon: { connections: log.monTransports[ 0 ].clients.size } } , 'New client #%i' , id ) ;
	
	socket.on( 'close' , function() {
		log.info( { mon: { connections: log.monTransports[ 0 ].clients.size } } , 'Client #%i disconnected' , id ) ;
	} ) ;
} ) ;


