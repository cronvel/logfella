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



/* BrowserConsole transport */



// Load modules
var CommonTransport = require( 'logfella-common-transport' ) ;



// Empty constructor, it is just there to support instanceof operator
function BrowserConsoleTransport() { throw new Error( "[logger] Cannot create a BrowserConsoleTransport object directly" ) ; }
module.exports = BrowserConsoleTransport ;

// Inherits from CommonTransport
BrowserConsoleTransport.prototype = Object.create( CommonTransport.prototype ) ;
BrowserConsoleTransport.prototype.constructor = BrowserConsoleTransport ;



BrowserConsoleTransport.create = function create( logger , config ) {
	var transport = Object.create( BrowserConsoleTransport.prototype ) ;
	transport.init( logger , config ) ;
	return transport ;
} ;



BrowserConsoleTransport.prototype.init = function init( logger , config ) {
	// Arguments management
	if ( config === null || typeof config !== 'object' ) { config = {} ; }

	// Call parent init()
	CommonTransport.prototype.init.call( this , logger , config ) ;

	Object.defineProperties( this , {
		color: { value: false , enumerable: true } ,
		indent: { value: config.indent === undefined ? true : !! config.indent , writable: true , enumerable: true } ,
		includeIdMeta: { value: !! config.includeIdMeta , writable: true , enumerable: true } ,
		includeCommonMeta: { value: config.includeCommonMeta === undefined ? true : !! config.includeCommonMeta , writable: true , enumerable: true } ,
		includeUserMeta: { value: config.includeUserMeta === undefined ? true : !! config.includeUserMeta , writable: true , enumerable: true }
	} ) ;
} ;



BrowserConsoleTransport.prototype.transport = function transport( data , cache , callback ) {
	//console.log( this.message( time , level , levelName , domain , message ) ) ;
	console.log( this.messageFormatter( data , cache ) + '\n' ) ;
	callback() ;
} ;


