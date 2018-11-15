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



var string = require( 'string-kit' ) ;
var tree = require( 'tree-kit' ) ;



var format = {} , formatColor = {} ;
tree.extend( { deep: true } , formatColor , string.format.default , { format: string.formatMethod , color: true } ) ;
tree.extend( { deep: true } , format , string.format.default , { format: string.formatMethod } ) ;
delete format.markup ;	// Turn style markup off



function message( data , color ) {
	var k , messageString = '' ;

	if ( data.mon ) {
		messageString = '\n' ;

		if ( color ) {
			for ( k in data.mon ) {
				messageString += string.ansi.green + k + string.ansi.reset + ': ' +
					string.ansi.cyan + data.mon[ k ] + string.ansi.reset + '\n' ;
			}
		}
		else {
			for ( k in data.mon ) { messageString += k + ': ' + data.mon[ k ] + '\n' ; }
		}
	}
	else if ( Array.isArray( data.messageData ) && data.isFormat ) {
		//if ( color ) { messageString = string.ansi.italic + string.formatMethod.apply( { color: true } , data.messageData ) ; }
		//else { messageString = string.formatMethod.apply( { color: false } , data.messageData ) ; }

		messageString = string.formatMethod.apply( color ? formatColor : format , data.messageData ) ;
	}
	else if ( data.messageData instanceof Error ) {
		messageString = string.inspectError( { style: color ? 'color' : 'none' } , data.messageData ) ;
	}
	else if ( typeof data.messageData !== 'string' ) {
		messageString = string.inspect( { style: color ? 'color' : 'none' } , data.messageData ) ;
	}
	else {
		// Even if messageData is not an array, it may contains markup, so it should be formated anyway
		//messageString = data.messageData ;
		messageString = string.formatMethod.call( color ? formatColor : format , data.messageData ) ;
	}

	return messageString ;
}



const symbols = [ '●' , '▄' , '▋' , '┃' , '━' , '╋' , '■' , '▲' , '▼' , '◀' , '▶' , '★' , '♠' , '♥' , '♦' , '♣' ] ;
//const fgColors = [ 'red' , 'green' , 'yellow' , 'blue' , 'magenta' , 'cyan' , 'brightRed' , 'brightGreen' , 'brightYellow' , 'brightBlue' , 'brightMagenta' , 'brightCyan' ] ;
//const bgColors = [ 'bgRed' , 'bgGreen' , 'bgYellow' , 'bgBlue' , 'bgMagenta' , 'bgCyan' , 'bgBrightRed' , 'bgBrightGreen' , 'bgBrightYellow' , 'bgBrightBlue' , 'bgBrightMagenta' , 'bgBrightCyan' ] ;
const fgColors = [ 'brightRed' , 'brightGreen' , 'brightYellow' , 'brightBlue' , 'brightMagenta' , 'brightCyan' ] ;
const bgColors = [ 'bgRed' , 'bgGreen' , 'bgYellow' , 'bgBlue' , 'bgMagenta' , 'bgCyan' ] ;



// Naive CRC-like algorithm
function hashSymbol( value ) {
	var i , iMax , sum = 0 , output ;

	value = '' + value ;

	for ( i = 0 , iMax = value.length ; i < iMax ; i ++ ) {
		sum += value.charCodeAt( i ) ;
		//sum += value.charCodeAt( i ) * ( i + 1 ) ;
	}

	output = symbols[ sum % symbols.length ] ;
	sum = Math.floor( sum / symbols.length ) ;

	output = string.ansi[ fgColors[ sum % fgColors.length ] ] + output ;
	sum = Math.floor( sum / fgColors.length ) ;

	output = string.ansi[ bgColors[ sum % bgColors.length ] ] + output ;
	sum = Math.floor( sum / bgColors.length ) ;

	output += string.ansi.reset ;

	return output ;
}



// The default message formater
exports.text = function text( data , cache ) {
	var cacheKey , metaKeys , first ,
		levelString = '' , timeString = '' , domainString = '' , idString = '' ,
		codeString = '' , metaString = '' , messageString = '' , stackString = '' ,
		symbolString = this.symbol ? '  ' : '' ,
		separatorString = '' ;

	if ( cache ) {
		cacheKey = 'text-' +
			( this.color ? 'c-' : '!c-' ) +
			( this.symbol ? 's-' : '!s-' ) +
			( this.indent ? 'i-' : '!i-' ) +
			( this.includeIdMeta ? 'im-' : '!im-' ) +
			( this.includeCommonMeta ? 'cm-' : '!cm-' ) +
			( this.includeUserMeta ? 'um-' : '!um-' ) +
			this.timeFormatter.name ;

		//console.log( "<<< Cache key:" , cacheKey ) ;

		// Cache hit!
		if ( cache[ cacheKey ] ) {
			//console.log( ">>> Cache hit!" ) ;
			return cache[ cacheKey ] ;
		}
	}

	// Build the message
	messageString = message( data , this.color ) ;

	// Message indentation
	if ( this.indent ) {
		messageString = messageString.replace( /\n/g , '\n    ' ) ;
	}

	// Final style reset
	//if ( this.color ) { messageString += string.ansi.reset ; }


	// Include built-in Meta
	if ( this.includeCommonMeta ) {
		timeString = this.color ?
			string.ansi.brightCyan + this.timeFormatter( data.time ) + string.ansi.reset + ' ' :
			this.timeFormatter( data.time ) + ' ' ;

		if ( data.domain && typeof data.domain === 'string' ) {
			domainString = this.color ?
				string.ansi.magenta + '<' + data.domain + '>' + string.ansi.reset + ' ' :
				'<' + data.domain + '> ' ;
		}

		if ( data.code !== undefined ) {
			codeString = this.color ?
				string.ansi.green + '#' + data.code + string.ansi.reset + ' ' :
				'#' + data.code + ' ' ;
		}

		// Five letter levelName
		switch ( data.levelName ) {
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
			case 'mon' :
				levelString = this.color ?
					string.ansi.cyan + '[ MON ]' + string.ansi.reset + ' ' :
					'[ MON ] ' ;
				break ;
			default :
				levelString = this.color ?
					string.ansi.dim + '[' + ( data.levelName + '.    ' ).slice( 0 , 5 ) + ']' + string.ansi.reset + ' ' :
					'[' + ( data.levelName + '.    ' ).slice( 0 , 5 ) + '] ' ;
		}

	}


	// Include process Meta
	if ( this.includeIdMeta ) {
		idString = this.color ?
			string.ansi.yellow + data.hostname + string.ansi.brightBlack + '(' + data.pid + ')' + string.ansi.reset + ' ' :
			data.hostname + '(' + data.pid + ') ' ;
	}


	// Include custom Meta
	if ( this.includeUserMeta && data.meta && ( metaKeys = Object.keys( data.meta ) ).length ) {

		metaString += this.color ?
			string.ansi.blue + '[' :
			'[' ;

		first = true ;

		metaKeys.forEach( metaKey => {
			if ( ! first ) {
				metaString += ' ' ;
				//metaString += string.ansi.brightBlack + '|' ;
			}

			first = false ;

			metaString += this.color ?
				string.ansi.yellow + metaKey + string.ansi.brightWhite + ':' :
				metaKey + ':' ;

			switch ( typeof data.meta[ metaKey ] ) {
				case 'number' :
					metaString += this.color ?
						string.ansi.cyan + data.meta[ metaKey ] :
						data.meta[ metaKey ] ;
					break ;
				case 'string' :
					metaString += this.color ?
						string.ansi.blue + string.ansi.italic + string.escape.control( data.meta[ metaKey ] ) + string.ansi.reset :
						JSON.stringify( data.meta[ metaKey ] ) ; // Because we need to fully escape both control chars and double-quotes, and enclose it inside double quotes
					break ;
				case 'object' :
					metaString += this.color ?
						string.ansi.magenta + JSON.stringify( data.meta[ metaKey ] ) :
						JSON.stringify( data.meta[ metaKey ] ) ;
					break ;
				default :
					metaString += this.color ?
						string.ansi.cyan + data.meta[ metaKey ] :
						'(' + data.meta[ metaKey ] + ')' ;
			}
		} ) ;

		metaString += this.color ?
			string.ansi.blue + ']' + string.ansi.reset + ' ' :
			'] ' ;

		if ( data.meta.id && this.symbol ) {
			symbolString = hashSymbol( data.meta.id ) + ' ' ;
		}
	}


	// Separator, if needed
	if ( this.includeIdMeta || this.includeCommonMeta || this.includeUserMeta ) {
		separatorString = this.color ?
			string.ansi.brightBlack + '--' + string.ansi.reset + ' ' :
			'-- ' ;
	}

	if ( 'stack' in data ) {
		stackString = '\n' + string.inspectStack( { style: this.color ? 'color' : 'none' } , data.stack ) ;
	}

	// Construct the whole message string...
	messageString = symbolString + levelString + timeString + idString + domainString + codeString + metaString + separatorString + messageString + stackString ;

	if ( cache ) { cache[ cacheKey ] = messageString ; }

	return messageString ;
} ;



// The JSON message formater
exports.json = function json( data , cache ) {
	var cacheKey , str ;

	if ( cache ) {
		cacheKey = 'json-' + ( this.color ? 'c-' : '!c-' ) ;
		//console.log( "<<< Cache key:" , cacheKey ) ;

		// Cache hit!
		if ( cache[ cacheKey ] ) {
			//console.log( ">>> Cache hit!" ) ;
			return cache[ cacheKey ] ;
		}
	}

	str = JSON.stringify( {
		app: data.app ,
		time: data.time.getTime() ,
		uptime: data.uptime ,
		pid: data.pid ,
		hostname: data.hostname ,
		domain: data.domain ,
		level: data.level ,
		levelName: data.levelName ,
		code: data.code ,
		mon: data.mon || undefined ,
		meta: data.meta || undefined ,
		messageData: data.mon ? undefined : data.messageData ,
		isFormat: data.isFormat ,
		message: data.mon ? undefined : message( data , this.color )
	} ) ;

	if ( cache ) { cache[ cacheKey ] = str ; }

	return str ;
} ;

