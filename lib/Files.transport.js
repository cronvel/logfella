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





			/* Files transport */



// Empty constructor, it is just there to support instanceof operator
function FilesTransport() { throw new Error( "[logger] Cannot create a FilesTransport object directly" ) ; }
module.exports = FilesTransport ;


// Inherits from CommonTransport
FilesTransport.prototype = Object.create( CommonTransport.prototype ) ;
FilesTransport.prototype.constructor = FilesTransport ;



FilesTransport.create = function create( parentLogger , minLevel , config )
{
	var transport = Object.create( FilesTransport.prototype ) ;
	transport.init( parentLogger , minLevel , config ) ;
	return transport ;
} ;



FilesTransport.prototype.init = function create( parentLogger , minLevel , config )
{
	// Arguments management
	if ( config === null || typeof config !== 'object' ) { config = {} ; }
	
	// Call parent init()
	CommonTransport.prototype.init.call( this , parentLogger , minLevel , config ) ;
	
	if ( typeof config.path !== 'string' ) { config.path = __dirname + '/' ; }
	else if ( config.path[ config.path.length - 1 ] !== '/' ) { config.path = config.path + '/' ; }
	
	Object.defineProperties( this , {
		// Never ever use color?
		// Actually, color may be useful when using 'tail -f'
		color: { value: !! config.color , writable: true , enumerable: true } ,
		path: { value: config.path , enumerable: true } ,
		streams: { value: {} , enumerable: true }
	} ) ;
} ;



FilesTransport.prototype.transport = function transport( time , level , levelName , domain , message , completionCallback )
{
	var self = this , realMessage , jobs ;
	
	realMessage = this.message( time , level , levelName , domain , message ) + '\n' ;
	
	jobs = [
		[ 'ALL-ALL.log' , realMessage ] ,
		[ levelName + '-ALL.log' , realMessage ]
	] ;
	
	if ( domain )
	{
		jobs.push( [ 'ALL-' + domain + '.log' , realMessage ] ) ;
		jobs.push( [ levelName + '-' + domain + '.log' , realMessage ] ) ;
	}
	
	async.parallel( jobs )
	.using( function( filename , message , jobCallback ) {
		self.appendToFile( filename , message , jobCallback ) ;
	} )
	.exec( completionCallback ) ;
} ;



FilesTransport.prototype.appendToFile = function appendToFile( filename , message , callback )
{
	if ( ! this.streams[ filename ] )
	{
		// Should open the writeStream first
		this.streams[ filename ] = fs.createWriteStream( this.path + filename , { flags: 'a' } ) ;
	}
	
	this.streams[ filename ].write( message , callback ) ;
} ;



