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

"use strict" ;



			/* NetServer transport */



// Load modules
var net = require( 'net' ) ;
var async = require( 'async-kit' ) ;

var CommonTransport = require( 'logfella-common-transport' ) ;



// Empty constructor, it is just there to support instanceof operator
function NetServerTransport() { throw new Error( "[logger] Cannot create a NetServerTransport object directly" ) ; }
module.exports = NetServerTransport ;

// Inherits from CommonTransport
NetServerTransport.prototype = Object.create( CommonTransport.prototype ) ;
NetServerTransport.prototype.constructor = NetServerTransport ;



NetServerTransport.create = function create( logger , config )
{
	var transport = Object.create( NetServerTransport.prototype ) ;
	transport.init( logger , config ) ;
	return transport ;
} ;



NetServerTransport.prototype.init = function init( logger , config )
{
	var self = this ;
	
	// Arguments management
	if ( config === null || typeof config !== 'object' ) { config = {} ; }
	
	if ( ! config.messageFormatter ) { config.messageFormatter = logger.messageFormatter.json ; }
	
	// Call parent init()
	CommonTransport.prototype.init.call( this , logger , config ) ;
	
	if ( ! config.listen ) { config.listen = 1234 ; }
	
	var server = net.createServer() ;
	
	server.listen( config.listen , function() {
		self.ready = true ;
	} ) ;
	
	server.on( 'error' , function( error ) {
		// Log? or not?
		self.shutdown() ;
	} ) ;
	
	server.on( 'connection' , this.onConnection.bind( this ) ) ;
	
	Object.defineProperties( this , {
		color: { value: config.color === undefined ? true : !! config.color , writable: true , enumerable: true } ,
		indent: { value: config.indent === undefined ? true : !! config.indent , writable: true , enumerable: true } ,
		includeIdMeta: { value: !! config.includeIdMeta , writable: true , enumerable: true } ,
		includeCommonMeta: { value: config.includeCommonMeta === undefined ? true : !! config.includeCommonMeta , writable: true , enumerable: true } ,
		includeUserMeta: { value: config.includeUserMeta === undefined ? true : !! config.includeUserMeta , writable: true , enumerable: true } ,
		output: { value: config.output || process.stdout , writable: true , enumerable: true } ,
		
		listen: { value: config.listen , writable: true , enumerable: true } ,
		server: { value: server , writable: true , enumerable: true } ,
		ready: { value: false , writable: true , enumerable: true } ,
		clients: { value: new Set() , writable: true , enumerable: true } ,
	} ) ;
} ;



NetServerTransport.prototype.onConnection = function onConnection( socket )
{
	var self = this ;
	
	//console.log( 'client connected' ) ;
	
	this.clients.add( socket ) ;
	
	socket.on( 'end' , function() {
		//console.log( 'client disconnected' ) ;
		self.clients.delete( socket ) ;
	} ) ;
	
	socket.on( 'error' , function() {
		//console.log( 'client error' ) ;
		socket.destroy() ;
		self.clients.delete( socket ) ;
	} ) ;
} ;



NetServerTransport.prototype.transport = function transport( data , cache , callback )
{
	// This is a Net Server, many clients can connect to it, so it does not care much
	// about who receive data before triggering its callback...
	
	// Also, no need to worry if the server is up or not: no client can be connected if the server is not ready.
	
	var socket , message ;
	
	if ( ! this.server || ! this.clients.size ) { callback() ; return ; }
	
	message = this.messageFormatter( data , cache ) + '\n' ;
	
	for ( socket of this.clients )
	{
		socket.write( message ) ;
	}
	
	// We consider that the message is delivered after the minimum timeout time
	setTimeout( callback , 0 ) ;
} ;



NetServerTransport.prototype.shutdown = function shutdown()
{
	var socket ;
	
	if ( this.server ) { this.server.close() ; }
	for ( socket of this.clients ) { socket.destroy() ; this.clients.delete( socket ) ; }
	
	delete this.server ;
	delete this.clients ;
} ;


