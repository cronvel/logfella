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

"use strict" ;



var CommonTransport = require( 'logfella-common-transport' ) ;
var fs = require( 'fs' ) ;
var path = require( 'path' ) ;
var Promise = require( 'seventh' ) ;



function FileTransport( logger , config = {} ) {
	CommonTransport.call( this , logger , config ) ;

	if ( typeof config.path !== 'string' ) { config.path = path.join( __dirname , '/app.log' ) ; }

	// Use color?
	// Actually, color may be useful when using 'tail -f'
	this.color = !! config.color ;
	this.indent = config.indent === undefined ? true : !! config.indent ;
	this.includeIdMeta = !! config.includeIdMeta ;
	this.includeCommonMeta = config.includeCommonMeta === undefined ? true : !! config.includeCommonMeta ;
	this.includeUserMeta = config.includeUserMeta === undefined ? true : !! config.includeUserMeta ;
	this.path = config.path ;
	this.stream = null ;
}

module.exports = FileTransport ;

FileTransport.prototype = Object.create( CommonTransport.prototype ) ;
FileTransport.prototype.constructor = FileTransport ;



FileTransport.prototype.transport = function transport( data , cache ) {
	if ( ! this.stream ) {
		// Should open the writeStream first
		this.stream = fs.createWriteStream( this.path , { flags: 'a' } ) ;
	}

	return new Promise( resolve => {
		this.stream.write( this.messageFormatter( data , cache ) + '\n' , () => { resolve() ; } ) ;
	} ) ;
} ;



FileTransport.prototype.shutdown = function shutdown() {
	if ( this.stream ) { this.stream.end() ; delete this.stream ; }
} ;

