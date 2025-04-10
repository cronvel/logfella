/*
	Logfella

	Copyright (c) 2015 - 2022 Cédric Ronvel

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
const Promise = require( 'seventh' ) ;



function ConsoleTransport( logger , config = {} ) {
	CommonTransport.call( this , logger , config ) ;

	this.output =
		config.output === 'stderr' ? process.stderr :
		//this.output === 'stdout' ? process.stdout :
		process.stdout ;

	this.isTTY = !! this.output.isTTY ;

	this.color =
		config.color !== undefined ? !! config.color :
		!! this.isTTY ;
	this.cleanLine =
		config.cleanLine !== undefined ? !! config.cleanLine :
		!! this.isTTY ;
	this.indent = config.indent !== undefined ? !! config.indent : true ;
	this.symbol = !! ( config.symbol && this.color ) ;
	this.includeIdMeta = !! config.includeIdMeta ;
	this.includeCommonMeta = config.includeCommonMeta !== undefined ? !! config.includeCommonMeta : true ;
	this.includeUserMeta = config.includeUserMeta !== undefined ? !! config.includeUserMeta : true ;
}

module.exports = ConsoleTransport ;

ConsoleTransport.prototype = Object.create( CommonTransport.prototype ) ;
ConsoleTransport.prototype.constructor = ConsoleTransport ;



const MOVE_TO_START_OF_LINE = '\x1b[1G' ;
const ERASE_LINE_AFTER = '\x1b[0K' ;



ConsoleTransport.prototype.transport = function( data , cache ) {
	// TTY are synchronous
	if ( this.isTTY ) {
		this.output.write(
			( this.cleanLine ? MOVE_TO_START_OF_LINE + ERASE_LINE_AFTER : '' )
			+ this.messageFormatter( data , cache )
			+ '\n'
		) ;
		return Promise.resolved ;
	}

	// Otherwise it is asynchronous
	return new Promise( resolve => {
		// We don't care about failure at all
		this.output.write( this.messageFormatter( data , cache ) + '\n' , () => resolve() ) ;
	} ) ;
} ;

