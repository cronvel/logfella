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




			/* Console transport */



// Load modules
var CommonTransport = require( './Common.transport.js' ) ;



// Empty constructor, it is just there to support instanceof operator
function ConsoleTransport() { throw new Error( "[logger] Cannot create a ConsoleTransport object directly" ) ; }
module.exports = ConsoleTransport ;

// Inherits from CommonTransport
ConsoleTransport.prototype = Object.create( CommonTransport.prototype ) ;
ConsoleTransport.prototype.constructor = ConsoleTransport ;



ConsoleTransport.create = function create( parentLogger , minLevel , config )
{
	var transport = Object.create( ConsoleTransport.prototype ) ;
	transport.init( parentLogger , minLevel , config ) ;
	return transport ;
} ;



ConsoleTransport.prototype.init = function create( parentLogger , minLevel , config )
{
	// Arguments management
	if ( config === null || typeof config !== 'object' ) { config = {} ; }
	
	// Call parent init()
	CommonTransport.prototype.init.call( this , parentLogger , minLevel , config ) ;
	
	Object.defineProperties( this , {
		color: { value: config.color === undefined ? true : !! config.color , writable: true , enumerable: true } ,
		output: { value: config.output || process.stdout , writable: true , enumerable: true }
	} ) ;
} ;



ConsoleTransport.prototype.transport = function transport( time , level , levelName , domain , message , callback )
{
	//console.log( this.message( time , level , levelName , domain , message ) ) ;
	this.output.write( this.message( time , level , levelName , domain , message ) + '\n' , callback ) ;
} ;


