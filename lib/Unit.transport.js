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



function UnitTransport( logger , config = {} ) {
	CommonTransport.call( this , logger , config ) ;

	this.color = false ;
	this.indent = false ;
	this.symbol = false ;
	this.includeIdMeta = !! config.includeIdMeta ;
	this.includeCommonMeta = config.includeCommonMeta === undefined ? true : !! config.includeCommonMeta ;
	this.includeUserMeta = config.includeUserMeta === undefined ? true : !! config.includeUserMeta ;
	this.entries = [] ;

	// Since this is used for testing the lib, we mess a bit with the main logfella instance, to ease access to functions
	logger.resetEntries = () => this.resetEntries() ;
	logger.getEntries = () => this.getEntries() ;
}

module.exports = UnitTransport ;

UnitTransport.prototype = Object.create( CommonTransport.prototype ) ;
UnitTransport.prototype.constructor = UnitTransport ;



// For unit test:
UnitTransport.prototype.resetEntries = function() { this.entries.length = 0 ; } ;
UnitTransport.prototype.getEntries = function() { return this.entries ; } ;



UnitTransport.prototype.transport = function( data , cache ) {
	this.entries.push( this.messageFormatter( data , cache ) ) ;
	return Promise.resolved ;
} ;

