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
var async = require( 'async-kit' ) ;
var string = require( 'string-kit' ) ;

var CommonTransport = require( './Common.transport.js' ) ;





// Empty constructor, it is just there to support instanceof operator
function Logger() { throw new Error( "[logger] Cannot create a Logger object directly" ) ; }
module.exports = Logger ;



var defaultLevelHash = {} ,
	defaultLevelArray = [ 'trace' , 'debug' , 'verbose' , 'info' , 'warning' , 'error' , 'fatal' ] ;

Logger.create = function create( config )
{
	var logger = Object.create( Logger.prototype , {
		transports: { value: [] , writable: true , enumerable: true } ,
		minLevel: { value: 3 , writable: true , enumerable: true } ,
		maxLevel: { value: Infinity , writable: true , enumerable: true } ,
		defaultDomain: { value: 'no-domain' , writable: true , enumerable: true } ,
		levelArray: { value: defaultLevelArray , writable: true , enumerable: true } ,
		levelHash: { value: defaultLevelHash , writable: true , enumerable: true }
	} ) ;
	
	if ( config ) { logger.setGlobalConfig( config ) ; }
	
	return logger ;
} ;



( function() {
	var i , name ;
	
	function createShortHand( name )
	{
		Logger.prototype[ name ] = function() {
			//console.error( "shorthand args:" , arguments ) ;
			//console.error( "transmitted: " , [ this.levelHash[ name ] ].concat( Array.prototype.slice.call( arguments ) ) ) ;
			return this.log.apply( this , [ this.levelHash[ name ] ].concat( Array.prototype.slice.call( arguments ) ) ) ;
		} ;
	}
	
	for ( i = 0 ; i < defaultLevelArray.length ; i ++ )
	{
		name = defaultLevelArray[ i ] ;
		defaultLevelHash[ name ] = i ;
		createShortHand( name ) ;
	}
} )() ;



Logger.prototype.use = function use( domain )
{
	// Force a domain
	var logger = Object.create( this , {
		domain: { value: domain , enumerable: true }
	} ) ;
	
	return logger ;
} ;



Logger.prototype.setGlobalConfig = function setGlobalConfig( config )
{
	if ( config.minLevel )
	{
		if ( typeof config.minLevel === 'number' ) { this.minLevel = config.minLevel ; }
		else if ( typeof config.minLevel === 'string' ) { this.minLevel = this.levelHash[ config.minLevel ] ; }
	}
	
	if ( config.maxLevel )
	{
		if ( typeof config.maxLevel === 'number' ) { this.maxLevel = config.maxLevel ; }
		else if ( typeof config.maxLevel === 'string' ) { this.maxLevel = this.levelHash[ config.maxLevel ] ; }
	}
	
	if ( config.defaultDomain && typeof config.defaultDomain === 'string' ) { this.defaultDomain = config.defaultDomain ; }
} ;



// log( level , domain , formatedMessage , [arg1] , [arg2] , ... , [callback] )
Logger.prototype.log = function log( level )
{
	var formatCount , callback , formatedMessage , formatedMessageIndex , data = {} ;
	
	//console.error( "???" , arguments ) ;
	
	// Level management should come first for early exit
	if ( typeof level === 'number' )
	{
		data.level = level ;
		data.levelName = this.levelArray[ level ] ;
	}
	else if ( typeof level === 'string' )
	{
		data.levelName = level ;
		data.level = this.levelHash[ level ] ;
	}
	
	if ( data.level === undefined || data.level < this.minLevel || data.level > this.maxLevel || data.levelName === undefined )
	{
		return ;
	}
	
	
	data.time = new Date() ;
	
	if ( this.domain )
	{
		data.domain = this.domain ;
		formatedMessageIndex = 1 ;
	}
	else
	{
		data.domain = typeof arguments[ 1 ] === 'string' ? arguments[ 1 ] : this.defaultDomain ;
		formatedMessageIndex = 2 ;
	}
	
	formatedMessage = arguments[ formatedMessageIndex ] ;
	
	// Variable list of arguments
	formatCount = string.format.count( formatedMessage ) ;	// Count formated arguments
	callback = arguments[ formatedMessageIndex + 1 + formatCount ] ;	// if any, the callback comes after formated arguments
	
	// Get the real message
	if ( ! formatCount )
	{
		data.message = formatedMessage ;
	}
	else
	{
		//console.error( "!!!" , arguments , Array.prototype.slice.call( arguments , formatedMessageIndex , formatedMessageIndex + 1 + formatCount ) ) ;
		data.message = string.format.apply(
			undefined ,
			Array.prototype.slice.call( arguments , formatedMessageIndex , formatedMessageIndex + 1 + formatCount )
		) ;
	}
	
	
	// Launch all transport in parallel mode
	// DO NOT nice(), some transport like 'console' (console.log()) should write as soon as possible to be relevant,
	// other transports should async by themself, if it's relevant
	
	async.parallel( this.transports )
	.using( function( transport , usingCallback ) {
		if ( level < transport.minLevel || level > transport.maxLevel )  { usingCallback() ; return ; }
		transport.transport( data , usingCallback ) ;
	} )
	.exec( callback ) ;
} ;



Logger.transports = {} ;



Logger.prototype.addTransport = function addTransport( transport , config )
{
	if ( typeof transport === 'string' )
	{
		transport = transport[ 0 ].toUpperCase() + transport.slice( 1 ) ;
		
		if ( Logger.transports[ transport ] === undefined )
		{
			try {
				Logger.transports[ transport ] = require( './' + transport + '.transport.js' ) ;
			}
			catch ( error ) {
				try {
					Logger.transports[ transport ] = require( 'logger-kit-' + transport + '-transport' ) ;
				}
				catch ( error ) {
					// Should a logger log error? or not? That's a good question!!!
				}
			}
		}
		
		transport = Logger.transports[ transport ] ;
	}
	
	if ( transport.prototype instanceof CommonTransport )
	{
		this.transports.push( transport.create( this , config ) ) ;
	}
} ;

Logger.prototype.removeAllTransports = function removeAllTransports() { this.transports = [] ; } ;



// Force a leading zero, so number have at least 2 digits
function leadingZero( num ) { return num >= 10 ? num : '0' + num ; }

Logger.prototype.timeFormatter = {} ;

// Full time formater, with date & time in ms
Logger.prototype.timeFormatter.dateTimeMs = function dateTimeMs( timeObject )
{
	return timeObject.getUTCFullYear() + '-' + leadingZero( timeObject.getUTCMonth() + 1 ) + '-' + leadingZero( timeObject.getUTCDate() ) +
		' ' + leadingZero( timeObject.getUTCHours() ) + ':' + leadingZero( timeObject.getUTCMinutes() ) + ':' + leadingZero( timeObject.getUTCSeconds() ) +
		'.' + ( timeObject.getUTCMilliseconds() / 1000 ).toFixed( 3 ).slice( 2 , 5 ) ;
} ;

// Date & time in s
Logger.prototype.timeFormatter.dateTime = function dateTime( timeObject )
{
	return timeObject.getUTCFullYear() + '-' + leadingZero( timeObject.getUTCMonth() + 1 ) + '-' + leadingZero( timeObject.getUTCDate() ) +
		' ' + leadingZero( timeObject.getUTCHours() ) + ':' + leadingZero( timeObject.getUTCMinutes() ) + ':' + leadingZero( timeObject.getUTCSeconds() ) ;
} ;

// Time in ms
Logger.prototype.timeFormatter.timeMs = function timeMs( timeObject )
{
	return leadingZero( timeObject.getUTCHours() ) + ':' + leadingZero( timeObject.getUTCMinutes() ) + ':' + leadingZero( timeObject.getUTCSeconds() ) +
		'.' + ( timeObject.getUTCMilliseconds() / 1000 ).toFixed( 3 ).slice( 2 , 5 ) ;
} ;

// Time in s
Logger.prototype.timeFormatter.time = function time( timeObject )
{
	return leadingZero( timeObject.getUTCHours() ) + ':' + leadingZero( timeObject.getUTCMinutes() ) + ':' + leadingZero( timeObject.getUTCSeconds() ) ;
} ;





// Global logger

Logger.global = Logger.create() ;
Logger.global.setGlobalConfig( { minLevel: 'trace' } ) ;
Logger.global.addTransport( 'console' , { minLevel: 'info' , color: true } ) ;
//Logger.global.addTransport( 'files' , 'trace' , { path: __dirname + '/test/log' } ) ;


