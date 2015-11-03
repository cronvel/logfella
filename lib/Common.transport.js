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



CommonTransport.create = function create( logger , config )
{
	var transport = Object.create( CommonTransport.prototype ) ;
	transport.init( logger , config ) ;
	return transport ;
} ;



CommonTransport.prototype.init = function init( logger , config )
{
	Object.defineProperties( this , {
		logger: { value: logger , enumerable: true } ,
		minLevel: { value: 0 , writable: true , enumerable: true } ,
		maxLevel: { value: 6 , writable: true , enumerable: true } ,
		timeFormatter: { value: logger.timeFormatter.time , writable: true , enumerable: true }
	} ) ;
	
	if ( config ) { this.setConfig( config ) ; }
} ;



CommonTransport.prototype.setConfig = function setConfig( config )
{
	if ( config.minLevel !== undefined )
	{
		if ( typeof config.minLevel === 'number' ) { this.minLevel = config.minLevel ; }
		else if ( typeof config.minLevel === 'string' ) { this.minLevel = this.logger.levelHash[ config.minLevel ] ; }
	}
	
	if ( config.maxLevel !== undefined )
	{
		if ( typeof config.maxLevel === 'number' ) { this.maxLevel = config.maxLevel ; }
		else if ( typeof config.maxLevel === 'string' ) { this.maxLevel = this.logger.levelHash[ config.maxLevel ] ; }
	}
	
	if ( config.timeFormatter )
	{
		if ( typeof config.timeFormatter === 'function' ) { this.timeFormatter = config.timeFormatter ; }
		else { this.timeFormatter = this.logger.timeFormatter[ config.timeFormatter ] ; }
	}
} ;



// The default message constructor
CommonTransport.prototype.formatMessage = function formatMessage( data )
{
	var colorCode , cacheKey ,
		levelString = '' , timeString = '' , domainString = '' , idString = '' ,
		codeString = '' , metaString = '' , messageString = '' , stackString = '' ,
		separatorString = '' ;

	cacheKey = 'std-' +
		( this.color ? 'c-' : '!c-' ) +
		( this.indent ? 'i-' : '!i-' ) +
		( this.includeIdMeta ? 'im-' : '!im-' ) +
		( this.includeCommonMeta ? 'cm-' : '!cm-' ) +
		( this.includeUserMeta ? 'um-' : '!um-' ) +
		this.timeFormatter.name ;
	
	//console.log( "<<< Cache key:" , cacheKey ) ;
	
	// Cache hit!
	if ( data.messageCache[ cacheKey ] )
	{
		//console.log( ">>> Cache hit!" ) ;
		return data.messageCache[ cacheKey ] ;
	}
	
	if ( Array.isArray( data.messageData ) && data.messageData.isFormat )
	{
		//if ( this.color ) { messageString = string.ansi.italic + string.formatMethod.apply( { color: true } , data.messageData ) ; }
		//else { messageString = string.formatMethod.apply( { color: false } , data.messageData ) ; }
		
		messageString = string.formatMethod.apply( { color: this.color } , data.messageData ) ;
	}
	else if ( data.messageData instanceof Error )
	{
		messageString = string.inspectError( { style: this.color ? 'color' : 'none' } , data.messageData ) ;
	}
	else if ( typeof data.messageData !== 'string' )
	{
		messageString = string.inspect( { style: this.color ? 'color' : 'none' } , data.messageData ) ;
	}
	else
	{
		//if ( this.color ) { messageString = string.ansi.italic + data.messageData ; }
		//else { messageString = data.messageData ; }
		
		messageString = data.messageData ;
	}
	
	
	// Message indentation
	if ( this.indent )
	{
		messageString = messageString.replace( /\n/g , '\n    ' ) ;
	}
	
	// Final style reset
	//if ( this.color ) { messageString += string.ansi.reset ; }
	
	
	// Include built-in Meta
	if ( this.includeCommonMeta )
	{
		timeString = this.color ?
			string.ansi.brightCyan + this.timeFormatter( data.time ) + string.ansi.reset + ' ' :
			this.timeFormatter( data.time ) + ' ' ;
		
		if ( data.domain && typeof data.domain === 'string' )
		{
			domainString = this.color ?
				string.ansi.magenta + '<' + data.domain + '>' + string.ansi.reset + ' ' :
				'<' + data.domain + '> ' ;
		}
		
		if ( data.code !== undefined )
		{
			codeString = this.color ?
				string.ansi.green + '#' + data.code + string.ansi.reset + ' ' :
				'#' + data.code + ' ' ;
		}
		
		// Five letter levelName
		switch ( data.levelName )
		{
			case 'trace' :
				levelString = this.color ?
					string.ansi.brightBlack + '[TRACE]' + string.ansi.reset + ' ' :
					'[TRACE] ' ;
				break ;
			case 'debug' :
				levelString = this.color ?
					string.ansi.dim + '[DEBUG]' + string.ansi.reset + ' ' :
					'[DEBUG] ' ;
				break ;
			case 'verbose' :
				levelString = this.color ?
					string.ansi.blue + '[VERB.]' + string.ansi.reset + ' ' :
					'[VERB.] ' ;
				break ;
			case 'info' :
				levelString = this.color ?
					string.ansi.brightWhite + '[INFO.]' + string.ansi.reset + ' ' :
					'[INFO.] ' ;
				break ;
			case 'warning' :
				levelString = this.color ?
					string.ansi.brightYellow + '[WARN.]' + string.ansi.reset + ' ' :
					'[WARN.] ' ;
				break ;
			case 'error' :
				levelString = this.color ?
					string.ansi.red + '[ERROR]' + string.ansi.reset + ' ' :
					'[ERROR] ' ;
				break ;
			case 'fatal' :
				levelString = this.color ?
					string.ansi.brightRed + string.ansi.bold + '[FATAL]' + string.ansi.reset + ' ' :
					'[FATAL] ' ;
				break ;
			default :
				levelString = this.color ?
					string.ansi.dim + '[' + ( data.levelName + '.    ' ).slice( 0 , 5 ) + ']' + string.ansi.reset + ' ' :
					'[' + ( data.levelName + '.    ' ).slice( 0 , 5 ) + '] ' ;
		}
		
	}
	
	
	// Include process Meta
	if ( this.includeIdMeta )
	{
		idString = this.color ?
			string.ansi.yellow + data.hostname + string.ansi.brightBlack + '(' + data.pid + ')' + string.ansi.reset + ' ' :
			data.hostname + '(' + data.pid + ') ' ;
	}
	
	
	// Include custom Meta
	if ( this.includeUserMeta && data.meta )
	{
		metaString = this.color ?
			string.ansi.blue + JSON.stringify( data.meta ) + string.ansi.reset + ' ' :
			JSON.stringify( data.meta ) + ' ' ;
	}
	
	
	// Separator, if needed
	if ( this.includeIdMeta || this.includeCommonMeta || this.includeUserMeta )
	{
		separatorString = this.color ?
			string.ansi.brightBlack + '--' + string.ansi.reset + ' ' :
			'-- ' ;
	}
	
	if ( 'stack' in data )
	{
		stackString = '\n' + string.inspectStack( { style: this.color ? 'color' : 'none' } , data.stack ) ;
	}
	
	// Construct the whole message string...
	messageString = levelString + timeString + idString + domainString + codeString + metaString + separatorString + messageString + stackString ;
	
	// Cache it!
	data.messageCache[ cacheKey ] = messageString ;
	
	return messageString ;
} ;


