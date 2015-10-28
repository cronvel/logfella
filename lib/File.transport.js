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



// Modules
var fs = require( 'fs' ) ;
var async = require( 'async-kit' ) ;
//var string = require( 'string-kit' ) ;

var CommonTransport = require( './Common.transport.js' ) ;





			/* File transport */



// Empty constructor, it is just there to support instanceof operator
function FileTransport() { throw new Error( "[logger] Cannot create a FileTransport object directly" ) ; }
module.exports = FileTransport ;


// Inherits from CommonTransport
FileTransport.prototype = Object.create( CommonTransport.prototype ) ;
FileTransport.prototype.constructor = FileTransport ;



FileTransport.create = function create( logger , config )
{
	var transport = Object.create( FileTransport.prototype ) ;
	transport.init( logger , config ) ;
	return transport ;
} ;



FileTransport.prototype.init = function create( logger , config )
{
	// Arguments management
	if ( config === null || typeof config !== 'object' ) { config = {} ; }
	
	// Call parent init()
	CommonTransport.prototype.init.call( this , logger , config ) ;
	
	if ( typeof config.path !== 'string' ) { config.path = __dirname + '/app.log' ; }
	
	Object.defineProperties( this , {
		// Use color?
		// Actually, color may be useful when using 'tail -f'
		color: { value: !! config.color , writable: true , enumerable: true } ,
		indent: { value: config.indent === undefined ? true : !! config.indent , writable: true , enumerable: true } ,
		includeBuiltInMeta: { value: config.includeBuiltInMeta === undefined ? true : !! config.includeBuiltInMeta , writable: true , enumerable: true } ,
		includeMeta: { value: config.includeMeta === undefined ? true : !! config.includeMeta , writable: true , enumerable: true } ,
		path: { value: config.path , enumerable: true } ,
		stream: { value: null , enumerable: true , writable: true }
	} ) ;
} ;



FileTransport.prototype.transport = function transport( data , completionCallback )
{
	var realMessage = this.formatMessage( data ) + '\n' ;
	
	if ( ! this.stream )
	{
		// Should open the writeStream first
		this.stream = fs.createWriteStream( this.path , { flags: 'a' } ) ;
	}
	
	this.stream.write( realMessage , completionCallback ) ;
} ;



