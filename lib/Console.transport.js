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
var Promise = require( 'seventh' ) ;



function ConsoleTransport( logger , config = {} ) {
	CommonTransport.call( this , logger , config ) ;

	this.color = config.color === undefined ? true : !! config.color ;
	this.indent = config.indent === undefined ? true : !! config.indent ;
	this.symbol = !! ( config.symbol && this.color ) ;
	this.includeIdMeta = !! config.includeIdMeta ;
	this.includeCommonMeta = config.includeCommonMeta === undefined ? true : !! config.includeCommonMeta ;
	this.includeUserMeta = config.includeUserMeta === undefined ? true : !! config.includeUserMeta ;
	this.output = config.output ;

	if ( this.output === 'stdout' ) {
		this.output = process.stdout ;
	}
	else if ( this.output === 'stderr' ) {
		this.output = process.stderr ;
	}
	else if ( ! this.output ) {
		this.output = process.stdout ;
	}
}

module.exports = ConsoleTransport ;

ConsoleTransport.prototype = Object.create( CommonTransport.prototype ) ;
ConsoleTransport.prototype.constructor = ConsoleTransport ;



ConsoleTransport.prototype.transport = function transport( data , cache ) {
	//console.log( this.message( time , level , levelName , domain , message ) ) ;
	if ( this.output.isTTY ) {
		this.output.write( this.messageFormatter( data , cache ) + '\n' ) ;
		return Promise.dummy ;
	}

	return new Promise( resolve => {
		this.output.write( this.messageFormatter( data , cache ) + '\n' , () => {
			// We don't care about failure at all
			resolve() ;
		} ) ;
	} ) ;
} ;

