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



const CommonTransport = require( 'logfella-common-transport' ) ;
const net = require( 'net' ) ;
const Promise = require( 'seventh' ) ;



function NetServerTransport( logger , config = {} ) {
	CommonTransport.call( this , logger , config ) ;

	this.color = config.color === undefined ? true : !! config.color ;
	this.indent = config.indent === undefined ? true : !! config.indent ;
	this.includeIdMeta = !! config.includeIdMeta ;
	this.includeCommonMeta = config.includeCommonMeta === undefined ? true : !! config.includeCommonMeta ;
	this.includeUserMeta = config.includeUserMeta === undefined ? true : !! config.includeUserMeta ;
	this.output = config.output || process.stdout ;

	if ( ! config.messageFormatter ) { this.messageFormatter = logger.messageFormatter.json ; }

	this.port = config.port || 1065 ;
	this.ready = false ;
	this.server = null ;
	this.clients = new Set() ;

	this.startServer() ;
}

module.exports = NetServerTransport ;

NetServerTransport.prototype = Object.create( CommonTransport.prototype ) ;
NetServerTransport.prototype.constructor = NetServerTransport ;



NetServerTransport.prototype.startServer = function() {
	this.server = net.createServer() ;

	this.server.listen( this.port , () => {
		this.ready = true ;
	} ) ;

	this.server.on( 'error' , () => {
		// Log? or not?
		this.shutdown() ;
	} ) ;

	this.server.on( 'connection' , this.onConnection.bind( this ) ) ;
} ;



NetServerTransport.prototype.onConnection = function( socket ) {
	//console.log( 'client connected' ) ;

	this.clients.add( socket ) ;

	socket.on( 'end' , () => {
		//console.log( 'client disconnected' ) ;
		this.clients.delete( socket ) ;
	} ) ;

	socket.on( 'error' , () => {
		//console.log( 'client error' ) ;
		socket.destroy() ;
		this.clients.delete( socket ) ;
	} ) ;
} ;



NetServerTransport.prototype.transport = function( data , cache ) {
	// This is a Net Server, many clients can connect to it, so it does not care much
	// about who received data before returning...
	// Also, no need to worry if the server is up or not: no client can be connected if the server is not ready.

	var socket , message ;

	if ( ! this.server || ! this.clients.size ) { return Promise.resolved ; }

	message = this.messageFormatter( data , cache ) + '\n' ;

	for ( socket of this.clients ) {
		socket.write( message ) ;
	}

	// We consider that the message is delivered after the minimum timeout time
	return Promise.resolveTimeout( 0 ) ;
} ;



NetServerTransport.prototype.shutdown = function() {
	var socket ;

	// Avoid multiple call trouble
	if ( this.alreadyShutdown ) { return ; }

	if ( this.server ) { this.server.close() ; }

	for ( socket of this.clients ) { socket.destroy() ; this.clients.delete( socket ) ; }

	delete this.server ;
	delete this.clients ;

	this.alreadyShutdown = true ;
} ;


