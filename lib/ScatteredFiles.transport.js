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





			/* ScatteredFiles transport */



// Empty constructor, it is just there to support instanceof operator
function ScatteredFilesTransport() { throw new Error( "[logger] Cannot create a ScatteredFilesTransport object directly" ) ; }
module.exports = ScatteredFilesTransport ;


// Inherits from CommonTransport
ScatteredFilesTransport.prototype = Object.create( CommonTransport.prototype ) ;
ScatteredFilesTransport.prototype.constructor = ScatteredFilesTransport ;



ScatteredFilesTransport.create = function create( logger , config )
{
	var transport = Object.create( ScatteredFilesTransport.prototype ) ;
	transport.init( logger , config ) ;
	return transport ;
} ;



ScatteredFilesTransport.prototype.init = function create( logger , config )
{
	// Arguments management
	if ( config === null || typeof config !== 'object' ) { config = {} ; }
	
	// Call parent init()
	CommonTransport.prototype.init.call( this , logger , config ) ;
	
	if ( typeof config.path !== 'string' ) { config.path = __dirname + '/' ; }
	else if ( config.path[ config.path.length - 1 ] !== '/' ) { config.path = config.path + '/' ; }
	
	Object.defineProperties( this , {
		// Use color?
		// Actually, color may be useful when using 'tail -f'
		color: { value: !! config.color , writable: true , enumerable: true } ,
		indent: { value: config.indent === undefined ? true : !! config.indent , writable: true , enumerable: true } ,
		includeBuiltInMeta: { value: config.includeBuiltInMeta === undefined ? true : !! config.includeBuiltInMeta , writable: true , enumerable: true } ,
		includeMeta: { value: config.includeMeta === undefined ? true : !! config.includeMeta , writable: true , enumerable: true } ,
		path: { value: config.path , enumerable: true } ,
		streams: { value: {} , enumerable: true }
	} ) ;
} ;



ScatteredFilesTransport.prototype.transport = function transport( data , completionCallback )
{
	var self = this , realMessage , jobs ;
	
	realMessage = this.formatMessage( data ) + '\n' ;
	
	jobs = [
		[ 'ALL-ALL.log' , realMessage ] ,
		[ data.levelName + '-ALL.log' , realMessage ]
	] ;
	
	if ( data.domain )
	{
		jobs.push( [ 'ALL-' + data.domain + '.log' , realMessage ] ) ;
		jobs.push( [ data.levelName + '-' + data.domain + '.log' , realMessage ] ) ;
	}
	
	async.parallel( jobs )
	.using( function( filename , message , jobCallback ) {
		self.appendToFile( filename , message , jobCallback ) ;
	} )
	.exec( completionCallback ) ;
} ;



ScatteredFilesTransport.prototype.appendToFile = function appendToFile( filename , message , callback )
{
	if ( ! this.streams[ filename ] )
	{
		// Should open the writeStream first
		this.streams[ filename ] = fs.createWriteStream( this.path + filename , { flags: 'a' } ) ;
	}
	
	this.streams[ filename ].write( message , callback ) ;
} ;



