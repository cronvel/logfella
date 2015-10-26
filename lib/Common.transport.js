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
var string = require( 'string-kit' ) ;



// Empty constructor, it is just there to support instanceof operator
function CommonTransport() { throw new Error( "[logger] Cannot create a CommonTransport object directly" ) ; }
module.exports = CommonTransport ;



CommonTransport.create = function create( parentLogger , minLevel , config )
{
	var transport = Object.create( CommonTransport.prototype ) ;
	transport.init( parentLogger , minLevel , config ) ;
	return transport ;
} ;



CommonTransport.prototype.init = function init( parentLogger , minLevel , config )
{
	// Arguments management
	if ( typeof minLevel === 'string' ) { minLevel = parentLogger.levelHash[ minLevel ] ; }
	if ( typeof minLevel !== 'number' ) { return ; }
	
	if ( config === null || typeof config !== 'object' ) { config = {} ; }
	
	Object.defineProperties( this , {
		logger: { value: parentLogger , enumerable: true } ,
		minLevel: { value: minLevel , writable: true , enumerable: true } ,
		timeFormatter: {
			writable: true ,
			enumerable: true ,
			value: typeof config.timeFormatter === 'function' ?
				config.timeFormatter :
				parentLogger.timeFormatter[ config.timeFormatter ] || parentLogger.timeFormatter.time
		}
	} ) ;
} ;



// The default message constructor
CommonTransport.prototype.message = function message( data )
{
	var colorCode , levelString , timeString , domainString ;
	
	timeString = this.timeFormatter( data.time ) + ' ' ;
	
	if ( ! data.domain || typeof data.domain !== 'string' ) { domainString = '' ; }
	else { domainString = "<" + data.domain + "> " ; }
	
	// Five letter levelName
	switch ( data.levelName )
	{
		case 'trace' : levelString = '[TRACE] ' ; break ;
		case 'debug' : levelString = '[DEBUG] ' ; break ;
		case 'verbose' : levelString = '[VERB.] ' ; break ;
		case 'info' : levelString = '[INFO.] ' ; break ;
		case 'warning' : levelString = '[WARN.] ' ; break ;
		case 'error' : levelString = '[ERROR] ' ; break ;
		case 'fatal' : levelString = '[FATAL] ' ; break ;
		default : levelString = '[' + ( levelName + '.    ' ).slice( 0 , 5 ) + '] ' ; break ;
	}
	
	if ( this.color )
	{
		switch ( data.levelName )
		{
			case 'trace' : colorCode = string.ansi.brightBlack ; break ;
			case 'debug' : colorCode = string.ansi.dim ; break ;
			case 'verbose' : colorCode = string.ansi.blue ; break ;
			case 'info' : colorCode = string.ansi.brightWhite ; break ;
			case 'warning' : colorCode = string.ansi.brightYellow ; break ;
			case 'error' : colorCode = string.ansi.red ; break ;
			case 'fatal' : colorCode = string.ansi.brightRed + string.ansi.bold ; break ;
			default : colorCode = string.ansi.dim ; break ;
		}
		
		levelString = colorCode + levelString + string.ansi.reset ;
	}
	
	return levelString + timeString + domainString + data.message ;
} ;


