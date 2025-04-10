(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Logfella = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
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



function BrowserConsoleTransport( logger , config ) {
	CommonTransport.call( this , logger , config ) ;

	this.color = false ;
	this.indent = config.indent === undefined ? true : !! config.indent ;
	this.includeIdMeta = !! config.includeIdMeta ;
	this.includeCommonMeta = config.includeCommonMeta === undefined ? true : !! config.includeCommonMeta ;
	this.includeUserMeta = config.includeUserMeta === undefined ? true : !! config.includeUserMeta ;
}

module.exports = BrowserConsoleTransport ;

BrowserConsoleTransport.prototype = Object.create( CommonTransport.prototype ) ;
BrowserConsoleTransport.prototype.constructor = BrowserConsoleTransport ;



BrowserConsoleTransport.prototype.transport = function( data , cache ) {
	console.log( this.messageFormatter( data , cache ) + '\n' ) ;
	return Promise.resolved ;
} ;


},{"logfella-common-transport":6,"seventh":15}],2:[function(require,module,exports){
(function (process){(function (){
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



const Promise = require( 'seventh' ) ;
const string = require( 'string-kit' ) ;
const treeOps = require( 'kung-fig-tree-ops' ) ;
const CommonTransport = require( 'logfella-common-transport' ) ;

var path , os ;
var browserPageTime ;

if ( process.browser ) {
	browserPageTime = Date.now() ;

	if ( process.uptime !== 'function' ) {
		process.uptime = () => Date.now() - browserPageTime ;
	}
}
else {
	path = require( 'path' ) ;
	os = require( 'os' ) ;
}



function Logfella( config ) {
	this.root = this ;
	this.perDomain = null ;
	this.logTransports = [] ;
	this.monTransports = [] ;
	this.app = null ;
	this.pid = null ;
	this.hostname = null ;
	this.minLevel = 3 ;
	this.maxLevel = 7 ;
	this.defaultDomain = 'no-domain' ;
	this.domain = null ;
	this.overrideConsole = false ;
	this.levelArray = defaultLevelArray ;
	this.levelHash = defaultLevelHash ;
	this.mon = { warnings: 0 , errors: 0 } ;
	this.monPeriod = null ;
	this.monStatus = 'stopped' ;

	// Hooks
	this.hook = null ;
	this.monHook = null ;

	// Should be not enumerable (circular)
	Object.defineProperty( this , 'root' , { value: this } ) ;

	if ( ! process.browser ) {
		// unknown case are produced when running REPL
		this.app = path.basename( process.argv[ 1 ] || '(unknown)' ) ;
		this.pid = process.pid ;
		this.hostname = os.hostname() ;
	}

	if ( config ) { this.configure( config ) ; }
}

module.exports = Logfella ;

// Backward compatibility
Logfella.create = ( ... args ) => new Logfella( ... args ) ;

Logfella.prototype.timeFormatter = require( './timeFormatter.js' ) ;
Logfella.prototype.messageFormatter = require( './messageFormatter.js' ) ;



const defaultLevelHash = {} ;
const defaultLevelArray = [ 'trace' , 'debug' , 'verbose' , 'info' , 'warning' , 'error' , 'fatal' , 'hdebug' ] ;
const defaultAvailableLevels = [] ;
const logOnceDomainMap = new Map() ;	// Store every formatedMessage that should be logged once per domain



( function() {
	var createShortHand = ( level , name ) => {
		Logfella.prototype[ name ] = function( ... args ) {
			// Early exit, if possible
			if ( ! this.perDomain && ( level < this.minLevel || level > this.maxLevel ) ) { return Promise.resolved ; }
			return this.log( level , false , ... args ) ;
		} ;

		Logfella.prototype[ name + 'Once' ] = function( ... args ) {
			// Early exit, if possible
			if ( ! this.perDomain && ( level < this.minLevel || level > this.maxLevel ) ) { return Promise.resolved ; }
			return this.log( level , true , ... args ) ;
		} ;
	} ;

	for ( let i = 0 ; i < defaultLevelArray.length ; i ++ ) {
		let name = defaultLevelArray[ i ] ;
		defaultLevelHash[ name ] = i ;
		defaultAvailableLevels.push( i ) ;
		defaultAvailableLevels.push( name ) ;
		createShortHand( i , name ) ;
	}
} )() ;



// Check if the current level is enable, userland
Logfella.prototype.checkLevel = function( level ) {
	if ( typeof level === 'string' ) {
		level = this.levelHash[ level ] ;
	}

	return level >= this.minLevel && level <= this.maxLevel ;
} ;



Logfella.defineOrConfig = function( name , config ) {
	if ( Logfella[ name ] ) {
		if ( Logfella[ name ] instanceof Logfella ) {
			Logfella[ name ].configure( config ) ;
		}
		else {
			throw new Error( "Logfella: '" + name + "' is reserved" ) ;
		}
	}
	else {
		Logfella[ name ] = new Logfella( config ) ;
	}
} ;



Logfella.prototype.use = function( domain ) {
	// Force a domain
	var logger = Object.create( this , {
		domain: { value: domain , enumerable: true }
	} ) ;

	return logger ;
} ;



Logfella.prototype.useHook = function( hook , monHook ) {
	// Force a hook
	var logger = Object.create( this , {
		hook: { value: hook , enumerable: true } ,
		monHook: { value: monHook , enumerable: true }
	} ) ;

	return logger ;
} ;



Logfella.prototype.setGlobalConfig =
Logfella.prototype.configure = function( config ) {
	if ( config.app ) { this.app = config.app ; }

	if ( config.minLevel !== undefined ) {
		if ( typeof config.minLevel === 'number' ) { this.minLevel = config.minLevel ; }
		else if ( typeof config.minLevel === 'string' ) { this.minLevel = this.levelHash[ config.minLevel ] ; }
	}

	if ( config.maxLevel !== undefined ) {
		if ( typeof config.maxLevel === 'number' ) { this.maxLevel = config.maxLevel ; }
		else if ( typeof config.maxLevel === 'string' ) { this.maxLevel = this.levelHash[ config.maxLevel ] ; }
	}

	if ( config.defaultDomain && typeof config.defaultDomain === 'string' ) { this.defaultDomain = config.defaultDomain ; }

	if ( config.overrideConsole !== undefined ) {
		if ( ! this.overrideConsole !== ! config.overrideConsole ) {
			if ( config.overrideConsole ) { this.replaceConsole() ; }
			else { this.restoreConsole() ; }
		}

		this.overrideConsole = !! config.overrideConsole ;
	}

	if ( config.monPeriod !== undefined ) {
		if ( ! config.monPeriod ) {
			this.monPeriod = null ;
			this.stopMon() ;
		}
		else if ( typeof config.monPeriod === 'number' ) {
			this.monPeriod = config.monPeriod ;
			this.startMon() ;
		}
	}

	if ( config.perDomain ) {
		for ( let k of Object.keys( config.perDomain ) ) {
			this.setDomainConfig( k , config.perDomain[ k ] ) ;
		}
	}

	if ( Array.isArray( config.transports ) ) {
		this.removeAllTransports() ;

		let iMax = config.transports.length ;

		for ( let i = 0 ; i < iMax ; i ++ ) {
			this.addTransport( config.transports[ i ].type , config.transports[ i ] ) ;
		}
	}
} ;



Logfella.prototype.disablePerDomainSettings = function() {
	this.perDomain = null ;
} ;



Logfella.prototype.setDomainConfig = function( domain , config ) {
	if ( ! this.perDomain ) { this.perDomain = {} ; }
	if ( ! this.perDomain[ domain ] ) { this.perDomain[ domain ] = {} ; }

	if ( config.minLevel ) {
		this.perDomain[ domain ].minLevel = typeof config.minLevel === 'string' ?
			this.levelHash[ config.minLevel ] :
			config.minLevel ;
	}

	if ( config.maxLevel ) {
		this.perDomain[ domain ].maxLevel = typeof config.maxLevel === 'string' ?
			this.levelHash[ config.maxLevel ] :
			config.maxLevel ;
	}
} ;



// log( level , domain , [code|meta] , formatedMessage , [arg1] , [arg2] , ... )
Logfella.prototype.log = function( level , once , ... args ) {
	var formatCount , formatedMessage , formatedMessageIndex , type , o , monModifier , perDomain ,
		levelName , domain , meta , code , hookData , messageData , isFormat , stack ;

	// /!\ Any change here should be reflected in .receive()

	if ( typeof level === 'number' ) {
		if ( level >= this.levelArray.length ) { return Promise.resolved ; }
		levelName = this.levelArray[ level ] ;
	}
	else if ( typeof level === 'string' ) {
		levelName = level ;
		level = this.levelHash[ levelName ] ;
		if ( level === undefined ) { return Promise.resolved ; }
	}
	else {
		return Promise.resolved ;
	}

	once = !! once ;

	if ( this.domain ) {
		domain = this.domain ;
		formatedMessageIndex = 0 ;
	}
	else {
		domain = typeof args[ 0 ] === 'string' ? args[ 0 ] : this.defaultDomain ;
		formatedMessageIndex = 1 ;
	}

	// Should be done before early-out
	if ( level >= 4 ) {
		// The user may override and fucked that up, so we ensure we deal with numbers
		if ( level >= 5 ) { this.mon.errors = + this.mon.errors + 1 || 1 ; }
		else { this.mon.warnings = + this.mon.warnings + 1 || 1 ; }
	}

	// Level management should come first for early exit
	if ( this.perDomain && ( perDomain = this.perDomain[ domain ] ) ) {
		// Per-domain filtering
		if (
			level < ( perDomain.minLevel !== undefined ? perDomain.minLevel : this.minLevel ) ||
			level > ( perDomain.maxLevel !== undefined ? perDomain.maxLevel : this.maxLevel )
		) {
			return Promise.resolved ;
		}
	}
	else if ( level < this.minLevel || level > this.maxLevel ) {
		return Promise.resolved ;
	}

	// Check if there is a 'code/meta' argument
	if ( args.length > formatedMessageIndex + 1 ) {
		type = typeof args[ formatedMessageIndex ] ;

		if ( args[ formatedMessageIndex ] && type === 'object' ) {
			// This is a 'meta' argument
			meta = args[ formatedMessageIndex ] ;

			// Extract the 'code' property, if any...
			if ( Object.hasOwn( meta , 'code' ) ) {
				code = meta.code ;
				delete meta.code ;
			}

			// Extract the 'mon' property, if any...
			if ( Object.hasOwn( meta , 'mon' ) ) {
				monModifier = meta.mon ;
				delete meta.mon ;
			}

			// Extract the 'hookData' property, if any...
			if ( Object.hasOwn( meta , 'hookData' ) ) {
				hookData = meta.hookData ;
				delete meta.hookData ;
			}

			formatedMessageIndex ++ ;
		}
		else if ( type === 'number' ) {
			// This is a 'code' argument
			code = args[ formatedMessageIndex ] ;
			formatedMessageIndex ++ ;
		}
		else if ( type === 'string' && args[ formatedMessageIndex ].indexOf( '%' ) === - 1 ) {
			// This is a 'code' argument
			code = args[ formatedMessageIndex ] ;
			formatedMessageIndex ++ ;
		}
	}

	formatedMessage = args[ formatedMessageIndex ] ;

	if ( once ) {
		let logOnceSet = logOnceDomainMap.get( domain ) ;

		if ( ! logOnceSet ) {
			logOnceSet = new Set() ;
			logOnceDomainMap.set( domain , logOnceSet ) ;
		}

		if ( logOnceSet.has( formatedMessage ) ) {
			return Promise.resolved ;
		}

		logOnceSet.add( formatedMessage ) ;
	}


	if ( monModifier && typeof monModifier === 'object' ) {
		treeOps.autoReduce( this.mon , monModifier ) ;
	}

	// Call the mon hook, if any
	if ( this.monHook ) { this.monHook( this.mon ) ; }

	// If there is no transport, skip now... Should come after monitoring operation
	if ( ! this.logTransports.length ) { return Promise.resolved ; }

	if ( typeof formatedMessage === 'string' ) {
		// Variable list of arguments
		formatCount = string.format.count( formatedMessage ) ;	// Count formated arguments

		if ( ! formatCount ) {
			messageData = formatedMessage ;
		}
		else {
			messageData = args.slice( formatedMessageIndex , formatedMessageIndex + 1 + formatCount ) ;
			isFormat = true ;
		}
	}
	else {
		messageData = formatedMessage ;
	}

	if ( level === 0 ) {
		// Add a stack trace for 'trace' level
		if ( process.browser ) {
			o = new Error() ;
		}
		else {
			o = {} ;
			Error.captureStackTrace( o , Logfella.prototype.trace ) ;

			if ( o.stack.indexOf( '\n' ) === - 1 ) {
				// The Logfella#log have been called instead of Logfella#trace

				// For some reason, Error.captureStackTrace() do not work twice on the same object,
				// even if the 'stack' property is deleted.
				o = {} ;
				Error.captureStackTrace( o , Logfella.prototype.log ) ;
			}
		}

		stack = o.stack ;
	}

	var data = {
		level ,
		levelName ,
		once ,
		domain ,
		meta ,
		monModifier ,
		code ,
		messageData ,
		isFormat ,
		stack ,
		hookData ,
		time: new Date()
	} ;

	return this.finalizeLog( data ) ;
} ;



Logfella.prototype.finalizeLog = function( data ) {
	var level = data.level ,
		cache = null ;

	// Finalize data
	data.app = this.app ;
	data.uptime = process.uptime() ;
	data.pid = this.pid ;
	data.hostname = this.hostname ;
	data.messageCache = {} ;

	// Call the hook, if any
	if ( this.hook ) { this.hook( data ) ; }

	var eachTransport = transport => {
		if ( level < transport.minLevel || level > transport.maxLevel )  { return Promise.resolved ; }
		return transport.transport( data , cache ) ;
	} ;

	// Fast and common use-case: only one transport (avoid all Promise.all() machinery)
	if ( this.logTransports.length === 1 ) {
		return eachTransport( this.logTransports[ 0 ] ) ;
	}

	// Only active cache if there are more than one transport
	cache = {} ;

	return Promise.all( this.logTransports.map( eachTransport ) ) ;
} ;



// This method is used when receiving log information from a remote Logfella instance (with Bridge transport and a userland transfer method).
Logfella.prototype.receive = function( data ) {
	var level = data.level ;

	// /!\ Any change in .log() should be reflected here.
	// Duplicated code is unavoidable because of all early-out optimization code.

	// Should be done before early-out
	if ( level >= 4 ) {
		// The user may override and fucked that up, so we ensure we deal with numbers
		if ( level >= 5 ) { this.mon.errors = + this.mon.errors + 1 || 1 ; }
		else { this.mon.warnings = + this.mon.warnings + 1 || 1 ; }
	}

	// Level management should come first for early exit
	let perDomain ;
	if ( this.perDomain && ( perDomain = this.perDomain[ data.domain ] ) ) {
		// Per-domain filtering
		if (
			level < ( perDomain.minLevel !== undefined ? perDomain.minLevel : this.minLevel ) ||
			level > ( perDomain.maxLevel !== undefined ? perDomain.maxLevel : this.maxLevel )
		) {
			return Promise.resolved ;
		}
	}
	else if ( level < this.minLevel || level > this.maxLevel ) {
		return Promise.resolved ;
	}

	if ( data.monModifier && typeof data.monModifier === 'object' ) {
		treeOps.autoReduce( this.mon , data.monModifier ) ;
	}

	// Call the mon hook, if any
	if ( this.monHook ) { this.monHook( this.mon ) ; }

	// If there is no transport, skip now... Should come after monitoring operation
	if ( ! this.logTransports.length ) { return Promise.resolved ; }

	return this.finalizeLog( data ) ;
} ;



Logfella.prototype.startMon = async function() {
	switch ( this.monStatus ) {
		case 'stopping' :
			// We have to wait until it is stopped
			await Promise.resolveTimeout( this.monPeriod ) ;
			return this.startMon() ;
		case 'stopped' :
			// Go!
			break ;
		case 'started' :
			// Already running
			return ;
	}

	if ( this.monStatus !== 'stopped' ) { return ; }
	this.monStatus = 'started' ;

	for ( ;; ) {
		await this.monFrame() ;
		await Promise.resolveTimeout( this.monPeriod ) ;

		switch ( this.monStatus ) {
			case 'stopping' :
				// We can now turn it into 'stopped'
				this.monStatus = 'stopped' ;
				return ;
			case 'stopped' :
				// Already stopped, return... (should never happen)
				return ;
			case 'started' :
				// Still running!
				break ;
		}
	}
} ;



Logfella.prototype.stopMon = function() {
	switch ( this.monStatus ) {
		case 'stopping' :
		case 'stopped' :
			return ;
		case 'started' :
			this.monStatus = 'stopping' ;
	}
} ;



Logfella.prototype.updateMon = function( monModifier ) {
	treeOps.autoReduce( this.mon , monModifier ) ;
} ;



// monFrame()
Logfella.prototype.monFrame = function() {
	if ( ! this.monTransports.length ) { return Promise.resolved ; }

	var cache = null ;

	var data = {
		level: null ,
		levelName: 'mon' ,
		app: this.app ,
		domain: this.domain || 'mon' ,
		time: new Date() ,
		uptime: process.uptime() ,
		pid: this.pid ,
		hostname: this.hostname ,
		mon: this.mon
	} ;

	// Fast and common use-case: only one transport (avoid all Promise.all() machinery)
	if ( this.monTransports.length === 1 ) {
		return this.monTransports[ 0 ].transport( data , cache ) ;
	}

	// Only active cache if there are more than one transport
	cache = {} ;

	return Promise.all( this.monTransports.map( transport => transport.transport( data , cache ) ) ) ;
} ;



Logfella.transports = {} ;



Logfella.prototype.addTransport = function( transport , config ) {
	var module_ , role , instance ;

	switch ( config.role ) {
		case 'mon' :
			role = 'monTransports' ;
			break ;
		case 'log' :
			role = 'logTransports' ;
			break ;
		default :
			role = 'logTransports' ;
			break ;
	}

	if ( typeof transport === 'string' ) {
		transport = transport[ 0 ].toUpperCase() + transport.slice( 1 ) ;

		if ( Logfella.transports[ transport ] === undefined && ! process.browser ) {
			try {
				// First try to get core transport
				module_ = require( './' + transport + '.transport.js' ) ;
			}
			catch ( error ) {
				try {
					// Then try to get a module
					module_ = require( 'logfella-' + string.camelCaseToDashed( transport ) + '-transport' ) ;
				}
				catch ( error_ ) {

					try {
						// Try to require the parent module: useful if Logfella is a devDependecy of a transport stand-alone module,
						// e.g.: unit tests of that transport.
						module_ = require( '../../../package.json' ) ;

						if ( module_.name === 'logfella-' + string.camelCaseToDashed( transport ) + '-transport' ) {
							module_ = require( '../../../' ) ;
						}
						else {
							// will be catched and throw
							throw null ;
						}
					}
					catch ( error__ ) {
						// Nothing could be loaded...
						// Should a logger log error? or not? That's a good question!!!
						throw new Error( "Logfella: can't load transport: " + transport ) ;
					}
				}
			}

			if ( ! ( module_.prototype instanceof CommonTransport ) ) {
				throw new Error( "Logfella: not an instance of CommonTranport: " + transport ) ;
			}

			Logfella.transports[ transport ] = module_ ;
		}

		transport = Logfella.transports[ transport ] ;
	}

	instance = new transport( this , config ) ;

	this[ role ].push( instance ) ;
} ;



Logfella.prototype.removeAllTransports = function() {
	var i , iMax ;

	for ( i = 0 , iMax = this.logTransports.length ; i < iMax ; i ++ ) { this.logTransports[ i ].shutdown() ; }
	for ( i = 0 , iMax = this.monTransports.length ; i < iMax ; i ++ ) { this.monTransports[ i ].shutdown() ; }

	this.logTransports = [] ;
	this.monTransports = [] ;
} ;



// This method should eventually become cross-platform
Logfella.setStackTraceLimit = function( depth ) {
	Error.stackTraceLimit = depth ;
} ;



var exitHandlersInstalled = false ;

if ( process.browser ) {
	// It does not make sense in browsers...
	Logfella.prototype.installExitHandlers = function() {} ;
}
else {
	Logfella.prototype.installExitHandlers = function() {
		var logger = this.root ;
		var domain = this.domain || 'logfella' ;

		if ( exitHandlersInstalled ) { return ; }
		exitHandlersInstalled = true ;

		process.on( 'asyncExit' , ( code , timeout , callback ) => {
			logger.info( domain , 'The process is about to exit within %ims with code %i...' , timeout , code ).then( callback ) ;
		} ) ;

		process.on( 'exit' , ( code ) => {
			logger.info( domain , 'The process is exiting with code %i...' , code ) ;
		} ) ;

		process.on( 'uncaughtException' , error => {
			if ( process.listenerCount( 'uncaughtException' ) <= 1 ) {
				// We are on our own
				logger.fatal( domain , 'Uncaught exception: %E' , error ).then( () => {
					// All underlying transports have finished, we can exit safely without losing logs...
					Promise.asyncExit( 1 ) ;
				} ) ;
			}
			else {
				// Another handler should have done something about that failure
				logger.fatal( domain , 'Uncaught exception: %E' , error ) ;
			}
		} ) ;

		process.on( 'unhandledRejection' , error => {
			logger.fatal( domain , 'Unhandled promise rejection: %E\n^rUnhandled rejection are ^R^+DEPRECATED^:^r and will end the Node.js process in the future!' , error ) ;
		} ) ;

		process.on( 'SIGINT' , () => {
			if ( process.listenerCount( 'SIGINT' ) <= 1 ) {
				// We are on our own
				logger.info( domain , 'Received a SIGINT signal.' ).then( () => {
					// All underlying transports have finished, we can exit safely without losing logs...
					Promise.asyncExit( 130 ) ;
				} ) ;
			}
			else {
				// Another handler should have done something about that failure
				logger.info( domain , 'Received a SIGINT signal.' ) ;
			}
		} ) ;

		process.on( 'SIGTERM' , () => {
			if ( process.listenerCount( 'SIGTERM' ) <= 1 ) {
				// We are on our own
				logger.info( domain , 'Received a SIGTERM signal.' ).then( () => {
					// All underlying transports have finished, we can exit safely without losing logs...
					Promise.asyncExit( 143 ) ;
				} ) ;
			}
			else {
				// Another handler should have done something about that failure
				logger.info( domain , 'Received a SIGTERM signal.' ) ;
			}
		} ) ;

		process.on( 'SIGHUP' , () => {
			if ( process.listenerCount( 'SIGHUP' ) <= 1 ) {
				// We are on our own
				logger.info( domain , 'Received a SIGHUP signal.' ).then( () => {
					// All underlying transports have finished, we can exit safely without losing logs...
					Promise.asyncExit( 129 ) ;
				} ) ;
			}
			else {
				// Another handler should have done something about that failure
				logger.info( domain , 'Received a SIGHUP signal.' ) ;
			}
		} ) ;
	} ;
}



var consoleBackup = {
	trace: console.trace ,
	log: console.log ,
	info: console.info ,
	warn: console.warn ,
	error: console.error ,
	dir: console.dir
} ;



function consoleReplacement( type , domain , ... args ) {
	var util = require( 'util' ) ;
	var message = string.escape.format( util.format( ... args ) ) ;
	return this[ type ]( domain , message ) ;
}



Logfella.prototype.replaceConsole = function() {
	console.trace = consoleReplacement.bind( this , 'trace' , 'console' ) ;
	console.log = consoleReplacement.bind( this , 'info' , 'console' ) ;
	console.info = consoleReplacement.bind( this , 'info' , 'console' ) ;
	console.warn = consoleReplacement.bind( this , 'warning' , 'console' ) ;
	console.error = consoleReplacement.bind( this , 'error' , 'console' ) ;
} ;



Logfella.prototype.restoreConsole = function() {
	console.trace = consoleBackup.trace ;
	console.log = consoleBackup.log ;
	console.info = consoleBackup.info ;
	console.warn = consoleBackup.warn ;
	console.error = consoleBackup.error ;
} ;



// Useful for third-party lib to validate the config
Logfella.configSchema = {
	type: 'strictObject' ,
	default: {} ,
	properties: {
		minLevel: { in: defaultAvailableLevels , default: 3 } ,
		maxLevel: { in: defaultAvailableLevels , default: 7 } ,
		defaultDomain: { type: 'string' , default: 'no-domain' } ,
		overrideConsole: { type: 'boolean' , default: false } ,
		monPeriod: { type: 'number' , default: null } ,
		perDomain: {
			type: 'strictObject' ,
			default: null ,
			of: {
				type: 'strictObject' ,
				extraProperties: true ,
				properties: {
					minLevel: { in: defaultAvailableLevels , default: 0 } ,
					maxLevel: { in: defaultAvailableLevels , default: 7 }
				}
			}
		} ,
		transports: {
			type: 'array' ,
			default: [] ,
			of: {
				type: 'strictObject' ,
				extraProperties: true ,
				properties: {
					type: { type: 'string' } ,
					role: { in: [ 'log' , 'mon' ] , default: 'log' } ,
					minLevel: { in: defaultAvailableLevels , default: 0 } ,
					maxLevel: { in: defaultAvailableLevels , default: 7 } ,
					messageFormatter: [ { type: 'function' } , { type: 'string' , optional: true } ] ,
					timeFormatter: [ { type: 'function' } , { type: 'string' , default: 'dateTime' } ] ,
					color: { type: 'boolean' , default: false }
				}
			}
		}
	}
} ;



// Global logger

Logfella.global = new Logfella() ;
Logfella.global.configure( { minLevel: 'trace' } ) ;

if ( process.browser ) {
	Logfella.transports.BrowserConsole = require( './BrowserConsole.transport.js' ) ;
	Logfella.global.addTransport( 'BrowserConsole' , { minLevel: 'trace' } ) ;
	window.Logfella = Logfella ;
}
else {
	Logfella.global.addTransport( 'console' , { minLevel: 'trace' , color: true , cleanLine: true } ) ;
	//Logfella.global.addTransport( 'files' , 'trace' , { path: __dirname + '/test/log' } ) ;
}


}).call(this)}).call(this,require('_process'))
},{"../../../":undefined,"../../../package.json":undefined,"./BrowserConsole.transport.js":1,"./messageFormatter.js":3,"./timeFormatter.js":4,"_process":74,"kung-fig-tree-ops":5,"logfella-common-transport":6,"os":72,"path":73,"seventh":15,"string-kit":34,"util":79}],3:[function(require,module,exports){
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



const string = require( 'string-kit' ) ;
const tree = require( 'tree-kit' ) ;



var format = {} , formatColor = {} ;
tree.extend( { deep: true } , formatColor , string.format.default , { format: string.formatMethod , color: true } ) ;
tree.extend( { deep: true } , format , string.format.default , { format: string.formatMethod } ) ;
delete format.markup ;	// Turn style markup off



function message( data , color ) {
	var messageString = '' ;

	if ( data.mon ) {
		messageString = '\n' ;

		if ( color ) {
			for ( let k of Object.keys( data.mon ) ) {
				messageString += string.ansi.green + k + string.ansi.reset + ': ' +
					string.ansi.cyan + data.mon[ k ] + string.ansi.reset + '\n' ;
			}
		}
		else {
			for ( let k of Object.keys( data.mon ) ) { messageString += k + ': ' + data.mon[ k ] + '\n' ; }
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



const symbols = [
	'▄' , '▋' , '┃' , '━' , '╋' , '●' , '■' , '◤' , '◢' , '▲' , '▼' , '◀' , '▶' , '★' , '☀' , '♠' , '♥' , '♦' , '♣'
	//, '☗' , '♚' , '♛' , '♜' , '♝' , '♞' , '♟'
] ;

//const fgColors = [ 'red' , 'green' , 'yellow' , 'blue' , 'magenta' , 'cyan' , 'brightRed' , 'brightGreen' , 'brightYellow' , 'brightBlue' , 'brightMagenta' , 'brightCyan' ] ;
//const bgColors = [ 'bgRed' , 'bgGreen' , 'bgYellow' , 'bgBlue' , 'bgMagenta' , 'bgCyan' , 'bgBrightRed' , 'bgBrightGreen' , 'bgBrightYellow' , 'bgBrightBlue' , 'bgBrightMagenta' , 'bgBrightCyan' ] ;
const fgColors = [ 'white' , 'brightRed' , 'brightGreen' , 'brightYellow' , 'brightBlue' , 'brightMagenta' , 'brightCyan' ] ;
const bgColors = [ 'bgBlack' , 'bgRed' , 'bgGreen' , 'bgYellow' , 'bgBlue' , 'bgMagenta' , 'bgCyan' ] ;



// Naive CRC-like algorithm
function hashSymbol( value ) {
	var i , iMax , hash = 0 , output , offset ;

	value = '' + value ;

	// At least 3 passes
	offset = 3 * 16 / value.length ;

	for ( i = 0 , iMax = value.length ; i < iMax ; i ++ ) {
		hash ^= value.charCodeAt( i ) << ( ( i * offset ) % 16 ) ;
		//hash += value.charCodeAt( i ) ;
		//hash += value.charCodeAt( i ) * ( i + 1 ) ;
	}

	output = symbols[ hash % symbols.length ] ;
	hash = Math.floor( hash / symbols.length ) ;

	output = string.ansi[ fgColors[ hash % fgColors.length ] ] + output ;
	hash = Math.floor( hash / fgColors.length ) ;

	output = string.ansi[ bgColors[ hash % bgColors.length ] ] + output ;
	hash = Math.floor( hash / bgColors.length ) ;

	output += string.ansi.reset ;

	return output ;
}



// The default message formater
exports.text = function( data , cache ) {
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
			case 'hdebug' :
				levelString = this.color ?
					string.ansi.brightGreen + string.ansi.bold + '[HDBUG]' + string.ansi.reset + ' ' :
					'[HDBUG] ' ;
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

	if ( data.stack !== undefined ) {
		stackString = '\n' + string.inspectStack( { style: this.color ? 'color' : 'none' } , data.stack ) ;
	}

	// Construct the whole message string...
	messageString = symbolString + levelString + timeString + idString + domainString + codeString + metaString + separatorString + messageString + stackString ;

	if ( cache ) { cache[ cacheKey ] = messageString ; }

	return messageString ;
} ;



// The JSON message formater
exports.json = function( data , cache ) {
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


},{"string-kit":34,"tree-kit":46}],4:[function(require,module,exports){
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



// Force a leading zero, so number have at least 2 digits
function leadingZero( num ) { return num >= 10 ? num : '0' + num ; }

// Full time formater, with date & time in ms
exports.dateTimeMs = function( timeObject ) {
	return timeObject.getUTCFullYear() + '-' + leadingZero( timeObject.getUTCMonth() + 1 ) + '-' + leadingZero( timeObject.getUTCDate() ) +
		' ' + leadingZero( timeObject.getUTCHours() ) + ':' + leadingZero( timeObject.getUTCMinutes() ) + ':' + leadingZero( timeObject.getUTCSeconds() ) +
		'.' + ( timeObject.getUTCMilliseconds() / 1000 ).toFixed( 3 ).slice( 2 , 5 ) ;
} ;

// Date & time in s
exports.dateTime = function( timeObject ) {
	return timeObject.getUTCFullYear() + '-' + leadingZero( timeObject.getUTCMonth() + 1 ) + '-' + leadingZero( timeObject.getUTCDate() ) +
		' ' + leadingZero( timeObject.getUTCHours() ) + ':' + leadingZero( timeObject.getUTCMinutes() ) + ':' + leadingZero( timeObject.getUTCSeconds() ) ;
} ;

// Time in ms
exports.timeMs = function( timeObject ) {
	return leadingZero( timeObject.getUTCHours() ) + ':' + leadingZero( timeObject.getUTCMinutes() ) + ':' + leadingZero( timeObject.getUTCSeconds() ) +
		'.' + ( timeObject.getUTCMilliseconds() / 1000 ).toFixed( 3 ).slice( 2 , 5 ) ;
} ;

// Time in s
exports.time = function( timeObject ) {
	return leadingZero( timeObject.getUTCHours() ) + ':' + leadingZero( timeObject.getUTCMinutes() ) + ':' + leadingZero( timeObject.getUTCSeconds() ) ;
} ;


},{}],5:[function(require,module,exports){
/*
	Kung Fig Tree Ops

	Copyright (c) 2015 - 2020 Cédric Ronvel

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



const treeOps = {} ;
module.exports = treeOps ;



// Reduce then transform to object
treeOps.reduceToObject = function( object , ... args ) {
	//return treeOps.toObject( treeOps.reduce.apply( this , arguments ) ) ;
	return treeOps.toObject( treeOps.reduce( object , ... args ) ) ;
} ;



// Remove all treeOps mark and operators, transform to a regular object with values
treeOps.toObject = function( object ) {
	if ( ! isPlainObject( object ) ) { return object ; }

	var i , iMax , parts , value ,
		output = {} ,
		keys = Object.keys( object ) ;

	for ( i = 0 , iMax = keys.length ; i < iMax ; i ++ ) {
		parts = this.splitOpKey( keys[ i ] ) ;

		// Skip operators
		if ( parts.operator ) { continue ; }

		value = object[ keys[ i ] ] ;

		if ( isPlainObject( value ) ) { value = treeOps.toObject( value ) ; }

		output[ parts.baseKey ] = value ;
	}

	return output ;
} ;



// Stack multiple object structure into one new object, do not apply operators
treeOps.stack = function( ... args ) {
	var i , iMax = args.length ,  stacked = {} ;

	for ( i = 0 ; i < iMax ; i ++ ) {
		//if ( ! args[ i ] || typeof args[ i ] !== 'object' || Array.isArray( args[ i ] ) ) { continue ; }
		if ( ! isPlainObject( args[ i ] ) ) { continue ; }
		this.stackInto( args[ i ] , stacked ) ;
	}

	return stacked ;
} ;



// Stack multiple object structure into the first object, do not apply operators
treeOps.autoStack = function( stacked , ... args ) {
	//if ( ! stacked || typeof stacked !== 'object' || Array.isArray( stacked ) ) { return stacked ; }
	if ( ! isPlainObject( stacked ) ) { return stacked ; }

	var i , iMax = args.length ;

	for ( i = 0 ; i < iMax ; i ++ ) {
		//if ( ! args[ i ] || typeof args[ i ] !== 'object' || Array.isArray( args[ i ] ) ) { continue ; }
		if ( ! isPlainObject( args[ i ] ) ) { continue ; }
		this.stackInto( args[ i ] , stacked ) ;
	}

	return stacked ;
} ;



// Stack the source into the target, do not apply operators
treeOps.stackInto = function( source , target ) {
	var i , iMax , parts , foreachKey , nonForeachKey , key , keys = Object.keys( source ) ;

	iMax = keys.length ;

	for ( i = 0 ; i < iMax ; i ++ ) {
		key = keys[ i ] ;

		// Skip empty keys, avoid infinite recursions, also the empty operator is not allowed on the root object
		if ( ! key ) { continue ; }

		parts = this.splitOpKey( key ) ;

		if ( parts.foreach ) {
			if ( Array.isArray( source[ key ] ) ) {
				nonForeachKey = key[ 0 ] === '(' ?
					'(' + key.slice( 2 ) :
					key.slice( 1 ) ;

				//console.log( "source is array, operator:" , parts.operator , nonForeachKey , target[ nonForeachKey ] ) ;
				if ( target[ nonForeachKey ] !== undefined ) {
					//console.log( "target non-foreach operator exist" ) ;
					if ( Array.isArray( target[ key ] ) ) { target[ key ].push( target[ nonForeachKey ] ) ; }
					else { target[ key ] = [ target[ nonForeachKey ] ] ; }
					delete target[ nonForeachKey ] ;
				}

				if ( Array.isArray( target[ key ] ) ) { target[ key ] = target[ key ].concat( source[ key ] ) ; }
				else { target[ key ] = source[ key ] ; }
			}

			continue ;
		}

		foreachKey = key[ 0 ] === '(' ?
			'(#' + key.slice( 1 ) :
			'#' + key ;

		if ( Array.isArray( target[ foreachKey ] ) ) {
			if ( target[ key ] === undefined ) {
				target[ foreachKey ].push( source[ key ] ) ;
			}
			else {
				target[ foreachKey ] = target[ foreachKey ].concat( [ target[ key ] , source[ key ] ] ) ;
			}

			delete target[ key ] ;
		}
		else if ( target[ key ] === undefined ) {
			target[ key ] = source[ key ] ;
		}
		else {
			target[ foreachKey ] = [ target[ key ] , source[ key ] ] ;
			delete target[ key ] ;
		}
	}
} ;



// Reduce a previously stacked (or not) object by applying operators.
// Do not modify the original object, create a brand new one.
// In case of multiple arguments, they are first “stacked” into a recipient object.
// Applied operators are removed.
treeOps.reduce = function( object , ... args ) {
	//if ( ! object || typeof object !== 'object' || Array.isArray( object ) ) { return object ; }
	if ( ! isPlainObject( object ) ) { return object ; }

	//object = this.stack.apply( this , arguments ) ;
	object = this.stack( object , ... args ) ;

	//console.log( "reduce after autoStack():" , require('string-kit').inspect( {style:'color',depth:10},object ) ) ;
	return this.reduceObject( object , [ object ] ) ;
} ;



// Reduce a previously stacked (or not) object by applying operators.
// In case of multiple arguments, they are first “autoStacked” into the first one before the first one is reduced.
// Applied operators are removed.
treeOps.autoReduce = function( object , ... args ) {
	//if ( ! object || typeof object !== 'object' || Array.isArray( object ) ) { return object ; }
	if ( ! isPlainObject( object ) ) { return object ; }

	//if ( args.length > 1 ) { this.autoStack.apply( this , arguments ) ; }
	if ( args.length > 0 ) { this.autoStack( object , ... args ) ; }

	//console.log( "autoReduce after autoStack():" , require('string-kit').inspect( {style:'color',depth:10},object ) ) ;
	return this.reduceObject( object , [ object ] ) ;
} ;



// Reduce one object
treeOps.reduceObject = function( object , antiCircularObjectList ) {
	var i , iMax , parts , ops = [] , operands , baseKey , key , keys = Object.keys( object ) ;

	iMax = keys.length ;

	// First, list all operations
	for ( i = 0 ; i < iMax ; i ++ ) {
		// Skip empty keys, avoid infinite recursions, also the empty operator is not allowed on the root object.
		// Also skip property with undefined value, undefined is the same as no property in the treeOps world.
		if ( ! keys[ i ] || object[ keys[ i ] ] === undefined ) { delete object[ keys[ i ] ] ; continue ; }

		parts = this.splitOpKey( keys[ i ] ) ;
		//console.log( "'" + parts.operator + "'" ) ;
		parts.rank = this.treeOperators[ parts.operator ].rank ;
		ops.push( parts ) ;
	}

	// Sort all operations, so they will be applied in the correct order
	ops.sort( sortOperations ) ;

	// Apply anything
	for ( i = 0 , iMax = ops.length ; i < iMax ; i ++ ) {
		baseKey = ops[ i ].baseKey ;
		key = ops[ i ].key ;

		if ( ! baseKey ) {
			// We want to combine with the root object, create a temporary clone

			//console.log( ">>> no basekey!" ) ;
			object[''] = {} ;
			this.assignObject( object[''] , object ) ;

			// Delete the operator about to be applied to from the clone, delete self-reference
			delete object[''][ key ] ;
			delete object[''][''] ;
		}

		if ( ops[ i ].foreach ) {
			if ( ! Array.isArray( object[ key ] ) ) {
				// This is a bad foreach key, due to a userland bad entry: remove that key and move forward.
				delete object[ key ] ;
				continue ;
			}

			object[ baseKey ] = this.treeOperators[ ops[ i ].operator ].reduce.call(
				this ,
				object[ baseKey ] ,
				object[ key ]
			) ;

			if ( object[ baseKey ] === undefined ) { delete object[ baseKey ] ; }

			if ( object[ key ].length === 0 ) { delete object[ key ] ; }
			else if ( object[ key ].length === 1 ) { object[ key.slice( 1 ) ] = object[ key ][ 0 ] ; delete object[ key ] ; }
		}
		else if ( ops[ i ].operator ) {
			operands = [ object[ key ] ] ;

			//console.log( ">>> before" ) ;
			//console.log( ">>> " , ops[ i ].operator ) ;
			object[ baseKey ] = this.treeOperators[ ops[ i ].operator ].reduce.call(
				this ,
				object[ baseKey ] ,
				operands
			) ;
			//console.log( ">>> after" ) ;

			if ( object[ baseKey ] === undefined ) { delete object[ baseKey ] ; }

			if ( operands.length === 0 ) { delete object[ key ] ; }
		}

		if (
			//object[ baseKey ] && typeof object[ baseKey ] === 'object' && ! Array.isArray( object[ baseKey ] ) &&
			isPlainObject( object[ baseKey ] ) &&
			antiCircularObjectList.indexOf( object[ baseKey ] ) === -1
		) {
			antiCircularObjectList.push( object[ baseKey ] ) ;
			this.reduceObject( object[ baseKey ] , antiCircularObjectList ) ;
		}

		if ( ! baseKey ) {
			// We have combined with the root object, assign the clone to the root

			//if ( object[''] && typeof object[''] === 'object' && ! Array.isArray( object[''] ) )
			if ( isPlainObject( object[''] ) ) {
				// The object ref has changed, but we cannot blindly assign object=object['']
				// because the parent object will still refer to the old one
				this.assignObject( object , object[''] ) ;
			}

			delete object[''] ;

			// Operations on the root object are typically unsafe: some remaining operations may had gone
			// and some new one should be created.
			// We have to run again reduceObject() for the whole newly assigned object.

			return this.reduceObject( object , antiCircularObjectList ) ;
		}
	}

	return object ;
} ;



function sortOperations( a , b ) {
	// First, the operator rank is checked,
	// then root object operations come last,
	// and finally 'foreach' operations come first
	return ( a.rank - b.rank ) ||
		( ( a.baseKey ? 0 : 1 ) - ( b.baseKey ? 0 : 1 ) ) ||
		( ( a.foreach ? 0 : 1 ) - ( b.foreach ? 0 : 1 ) ) ;
}



function isPlainObject( value ) {
	var proto ;

	return value &&
		typeof value === 'object' &&
		( ( proto = Object.getPrototypeOf( value ) ) === Object.prototype || proto === null ) ;
}



// Those operators do not need to be inside ()
treeOps.reservedOperators = {
//	'@': true ,	// needed?
	'+': true ,
	'-': true ,
	'*': true ,
	'/': true ,
	'*>': true ,
	'<*': true ,
	'*>>': true ,
	'<<*': true ,
	'+>': true ,
	'<+': true
} ;

// Expand them all with the 'foreach' prefix (#)
Object.keys( treeOps.reservedOperators ).forEach( ( k ) => {
	treeOps.reservedOperators[ '#' + k ] = true ;
} ) ;



treeOps.reservedKeyStart = {
//	'@': true ,	// needed?
	'#': true ,
	'(': true ,
	'+': true ,
	'-': true ,
	'*': true ,
	'/': true ,
	'<': true ,
	'?': true ,
	'!': true ,
	'^': true
} ;



// NOTE: it MUST be efficient, hence the strange switch-case hell

treeOps.splitOpKey = function( key ) {
	var i , iMax , opkey = key , splitted , foreach = false ;

	if ( opkey[ 0 ] === '(' ) {
		opkey = key.slice( 1 ) ;

		if ( opkey[ 0 ] === '#' ) {
			foreach = true ;
			opkey = opkey.slice( 1 ) ;
		}

		for ( i = 0 , iMax = opkey.length ; i < iMax && opkey[ i ] !== ')' ; i ++ ) { /* empty */ }

		splitted = {
			operator: opkey.slice( 0 , i ) , baseKey: opkey.slice( i + 1 ) , key: key
		} ;
	}
	else {
		if ( opkey[ 0 ] === '#' ) {
			foreach = true ;
			opkey = opkey.slice( 1 ) ;
		}

		switch ( opkey[ 0 ] ) {
			/*
			case '$' :
				splitted = { operator: '$' , baseKey: opkey.slice( 1 ) , key: key } ;
				break ;
			*/
			case '+' :
				switch ( opkey[ 1 ] ) {
					case '>' :
						splitted = {
							operator: '+>' , baseKey: opkey.slice( 2 ) , key: key
						} ;
						break ;
					default :
						splitted = {
							operator: '+' , baseKey: opkey.slice( 1 ) , key: key
						} ;
				}
				break ;
			case '-' :
				splitted = {
					operator: '-' , baseKey: opkey.slice( 1 ) , key: key
				} ;
				break ;
			case '*' :
				switch ( opkey[ 1 ] ) {
					case '>' :
						switch ( opkey[ 2 ] ) {
							case '>' :
								splitted = {
									operator: '*>>' , baseKey: opkey.slice( 3 ) , key: key
								} ;
								break ;
							default :
								splitted = {
									operator: '*>' , baseKey: opkey.slice( 2 ) , key: key
								} ;
						}
						break ;
					default :
						splitted = {
							operator: '*' , baseKey: opkey.slice( 1 ) , key: key
						} ;
				}
				break ;
			case '/' :
				splitted = {
					operator: '/' , baseKey: opkey.slice( 1 ) , key: key
				} ;
				break ;
			case '<' :
				switch ( opkey[ 1 ] ) {
					case '<' :
						switch ( opkey[ 2 ] ) {
							case '*' :
								splitted = {
									operator: '<<*' , baseKey: opkey.slice( 3 ) , key: key
								} ;
								break ;
							default :
								splitted = {
									operator: '' , baseKey: opkey , key: key
								} ;
						}
						break ;
					case '*' :
						splitted = {
							operator: '<*' , baseKey: opkey.slice( 2 ) , key: key
						} ;
						break ;
					case '+' :
						splitted = {
							operator: '<+' , baseKey: opkey.slice( 2 ) , key: key
						} ;
						break ;
					case '^' :
						splitted = {
							operator: '<^' , baseKey: opkey.slice( 2 ) , key: key
						} ;
						break ;
					default :
						splitted = {
							operator: '' , baseKey: opkey , key: key
						} ;
				}
				break ;
			case '^' :
				splitted = {
					operator: '^' , baseKey: opkey.slice( 1 ) , key: key
				} ;
				break ;
			//case '@' :
			//	/!\ Typically, this should never been encountered here, but solved at file loading
			//	splitted = { operator: '@' , baseKey: opkey.slice( 1 ) , key: key } ;
			default :
				splitted = {
					operator: '' , baseKey: opkey , key: key
				} ;
		}
	}

	splitted.foreach = foreach ;
	splitted.fullOperator = foreach ? '#' + splitted.operator : splitted.operator ;

	return splitted ;
} ;



treeOps.assignObject = function( target , source ) {
	var k ;

	for ( k in target ) { delete target[ k ] ; }
	for ( k in source ) { target[ k ] = source[ k ] ; }
} ;



/*
ASCII: &~#{}()[]-|`\_^°+=$%><*?,;.:/!
ASCII 8bits: §«»

# foreach prefix: the operand is an array, the operator should be applied to each element

+ add
- substract
* multiply
/ divide
+> append (string, array)
<+ prepend (string, array)
*> merge after (object), i.e. overwrite
<* merge before (object), i.e. do not overwrite
*>> merge after, lesser priority
<<* merge before, lesser priority

Not implemented yet / not specified:
*+> merge after (object), i.e. overwrite, use concat after when possible
<+* merge before (object), i.e. do not overwrite, use concat before when possible
$ global reference/link
?: set if it does not exist (define)?
!: set if it exists (rewrite)?
! delete?
_ gettext?
^ pow
<^ exp (the arg is the base, the existing key is the exponent)
*/

treeOps.treeOperators = {} ;

var rank = 0 ;

// The order matter: it is sorted from the highest to the lowest priority

// key: the full key, prepended by the operator
// baseKey: the key without the operator

// Assign operator (aka empty operator)
treeOps.treeOperators[''] = {
	rank: rank ++ ,
	reduce: function( existing , operands ) {
		var i , iMax = operands.length ;

		for ( i = 0 ; i < iMax ; i ++ ) {
			if (
				//existing && typeof existing === 'object' && ! Array.isArray( existing ) &&
				//operands[ i ] && typeof operands[ i ] === 'object' && ! Array.isArray( operands[ i ] )
				isPlainObject( existing ) && isPlainObject( operands[ i ] )
			) {
				// Both are object: autoReduce
				this.autoReduce( existing , operands[ i ] ) ;
			}
			else {
				// One of them is not an object: assign
				existing = operands[ i ] ;
			}
		}

		operands.length = 0 ;
		return existing ;
	}
} ;

// Combine (subtree) before
treeOps.treeOperators['<*'] = {
	rank: rank ++ ,
	reduce: function( existing , operands ) {
		//if ( ! existing || typeof existing !== 'object' || Array.isArray( existing ) )
		if ( ! isPlainObject( existing ) ) {
			// Do nothing...
			return existing ;
		}

		// We have to reverse things before calling autoReduce()
		var rcpt = {} ;
		var args = [ existing ].concat( operands ).concat( rcpt ).reverse() ;

		//this.autoReduce.apply( this , args ) ;
		this.autoReduce( ... args ) ;
		operands.length = 0 ;

		return rcpt ;

		// Or:
		// this.assignObject( existing , rcpt ) ;
		// return existing ;
	}
} ;

// Combine (subtree) after
treeOps.treeOperators['*>'] = {
	rank: rank ++ ,
	reduce: function( existing , operands ) {
		//if ( ! existing || typeof existing !== 'object' || Array.isArray( existing ) )
		if ( ! isPlainObject( existing ) ) {
			// Do nothing...
			return existing ;
		}

		//console.log( "calling autoReduce with:" , require('string-kit').inspect( {style:'color',depth:10},[ existing ].concat( operands ) ) ) ;
		//this.autoReduce.apply( this , [ existing ].concat( operands ) ) ;
		this.autoReduce( existing , ... operands ) ;
		operands.length = 0 ;
		return existing ;
	}
} ;

// Combine (subtree) before, lower priority
treeOps.treeOperators['<<*'] = {
	rank: rank ++ ,
	reduce: treeOps.treeOperators['<*'].reduce
} ;

// Combine (subtree) after, lower priority
treeOps.treeOperators['*>>'] = {
	rank: rank ++ ,
	reduce: treeOps.treeOperators['*>'].reduce
} ;

// Concat before / prepend
treeOps.treeOperators['<+'] = {
	rank: rank ++ ,
	reduce: function( existing , operands ) {
		var i , iMax = operands.length , operand = [] ;

		for ( i = 0 ; i < iMax ; i ++ ) {
			if ( Array.isArray( operands[ i ] ) ) {
				operand = operands[ i ].concat( operand ) ;
			}
		}

		if ( Array.isArray( existing ) ) {
			existing = operand.concat( existing ) ;
			operands.length = 0 ;
			return existing ;
		}

		operands[ 0 ] = operand ;
		operands.length = 1 ;
		return existing ;

	}
} ;

// Concat after / append
treeOps.treeOperators['+>'] = {
	rank: rank ++ ,
	reduce: function( existing , operands ) {
		var i , iMax = operands.length , operand = [] ;

		for ( i = 0 ; i < iMax ; i ++ ) {
			if ( Array.isArray( operands[ i ] ) ) {
				operand = operand.concat( operands[ i ] ) ;
			}
		}

		if ( Array.isArray( existing ) ) {
			existing = existing.concat( operand ) ;
			operands.length = 0 ;
			return existing ;
		}

		operands[ 0 ] = operand ;
		operands.length = 1 ;
		return existing ;

	}
} ;

treeOps.treeOperators['/'] = {
	rank: rank ++ ,
	reduce: function( existing , operands ) {
		var i , iMax = operands.length , operand = 1 ;

		for ( i = 0 ; i < iMax ; i ++ ) {
			if ( ! isNaN( operands[ i ] ) ) {
				operand *= + operands[ i ] ;
			}
		}

		if ( ! isNaN( existing ) ) {
			existing = + existing / operand ;
			operands.length = 0 ;
			return existing ;
		}

		operands[ 0 ] = operand ;
		operands.length = 1 ;
		return existing ;

	}
} ;

treeOps.treeOperators['*'] = {
	rank: rank ++ ,
	reduce: function( existing , operands ) {
		var i , iMax = operands.length , operand = 1 ;

		for ( i = 0 ; i < iMax ; i ++ ) {
			if ( ! isNaN( operands[ i ] ) ) {
				operand *= + operands[ i ] ;
			}
		}

		if ( ! isNaN( existing ) ) {
			existing = + existing * operand ;
			operands.length = 0 ;
			return existing ;
		}

		operands[ 0 ] = operand ;
		operands.length = 1 ;
		return existing ;

	}
} ;

treeOps.treeOperators['-'] = {
	rank: rank ++ ,
	reduce: function( existing , operands ) {
		var i , iMax = operands.length , operand = 0 ;

		for ( i = 0 ; i < iMax ; i ++ ) {
			if ( ! isNaN( operands[ i ] ) ) {
				operand += + operands[ i ] ;
			}
		}

		if ( ! isNaN( existing ) ) {
			existing = + existing - operand ;
			operands.length = 0 ;
			return existing ;
		}

		operands[ 0 ] = operand ;
		operands.length = 1 ;
		return existing ;

	}
} ;

treeOps.treeOperators['+'] = {
	rank: rank ++ ,
	reduce: function( existing , operands ) {
		var i , iMax = operands.length , operand = 0 ;

		for ( i = 0 ; i < iMax ; i ++ ) {
			if ( ! isNaN( operands[ i ] ) ) {
				operand += + operands[ i ] ;
			}
		}

		if ( ! isNaN( existing ) ) {
			existing = + existing + operand ;
			operands.length = 0 ;
			return existing ;
		}

		operands[ 0 ] = operand ;
		operands.length = 1 ;
		return existing ;

	}
} ;



/*
The link mechanism is more complicated: it needs multipass at whole-tree level

treeOps.treeOperators['$'] = {
	rank: rank ++ ,
	multipass: true ,
	reduce: function( target , key , baseKey , root ) {

		var parts , source = root ;

		if ( target[ key ] ) { source = tree.path.get( root , target[ key ] ) ; }

		target[ baseKey ] = source ;
		delete target[ key ] ;

		// Multipass
		parts = this.splitOpKey( baseKey ) ;
		parts.rank = this.treeOperators[ parts.operator ].rank ;

		return parts ;
	}
} ;
*/



// Add operators to treeOps
treeOps.extendTreeOperators = function( operators ) {
	Object.assign( treeOps.treeOperators , operators ) ;
} ;


},{}],6:[function(require,module,exports){
/*
	Logfella Common Transport

	Copyright (c) 2015 - 2019 Cédric Ronvel

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



// Empty constructor, it is just there to support instanceof operator
function CommonTransport( logger , config = {} ) {
	this.logger = null ;
	this.monitoring = false ;
	this.minLevel = 0 ;
	this.maxLevel = 7 ;
	this.messageFormatter = logger.messageFormatter.text ;
	this.timeFormatter = logger.timeFormatter.dateTime ;

	Object.defineProperty( this , 'logger' , { value: logger } ) ;

	if ( config.monitoring !== undefined ) { this.monitoring = !! config.monitoring ; }

	if ( config.minLevel !== undefined ) {
		if ( typeof config.minLevel === 'number' ) { this.minLevel = config.minLevel ; }
		else if ( typeof config.minLevel === 'string' ) { this.minLevel = this.logger.levelHash[ config.minLevel ] ; }
	}

	if ( config.maxLevel !== undefined ) {
		if ( typeof config.maxLevel === 'number' ) { this.maxLevel = config.maxLevel ; }
		else if ( typeof config.maxLevel === 'string' ) { this.maxLevel = this.logger.levelHash[ config.maxLevel ] ; }
	}

	if ( config.messageFormatter ) {
		if ( typeof config.messageFormatter === 'function' ) { this.messageFormatter = config.messageFormatter ; }
		else { this.messageFormatter = this.logger.messageFormatter[ config.messageFormatter ] ; }
	}

	if ( config.timeFormatter ) {
		if ( typeof config.timeFormatter === 'function' ) { this.timeFormatter = config.timeFormatter ; }
		else { this.timeFormatter = this.logger.timeFormatter[ config.timeFormatter ] ; }
	}
}

module.exports = CommonTransport ;



CommonTransport.prototype.transport = function transport( data , cache ) {} ;
CommonTransport.prototype.shutdown = function shutdown() {} ;


},{}],7:[function(require,module,exports){
(function (process,global){(function (){
(function (global, undefined) {
    "use strict";

    if (global.setImmediate) {
        return;
    }

    var nextHandle = 1; // Spec says greater than zero
    var tasksByHandle = {};
    var currentlyRunningATask = false;
    var doc = global.document;
    var registerImmediate;

    function setImmediate(callback) {
      // Callback can either be a function or a string
      if (typeof callback !== "function") {
        callback = new Function("" + callback);
      }
      // Copy function arguments
      var args = new Array(arguments.length - 1);
      for (var i = 0; i < args.length; i++) {
          args[i] = arguments[i + 1];
      }
      // Store and register the task
      var task = { callback: callback, args: args };
      tasksByHandle[nextHandle] = task;
      registerImmediate(nextHandle);
      return nextHandle++;
    }

    function clearImmediate(handle) {
        delete tasksByHandle[handle];
    }

    function run(task) {
        var callback = task.callback;
        var args = task.args;
        switch (args.length) {
        case 0:
            callback();
            break;
        case 1:
            callback(args[0]);
            break;
        case 2:
            callback(args[0], args[1]);
            break;
        case 3:
            callback(args[0], args[1], args[2]);
            break;
        default:
            callback.apply(undefined, args);
            break;
        }
    }

    function runIfPresent(handle) {
        // From the spec: "Wait until any invocations of this algorithm started before this one have completed."
        // So if we're currently running a task, we'll need to delay this invocation.
        if (currentlyRunningATask) {
            // Delay by doing a setTimeout. setImmediate was tried instead, but in Firefox 7 it generated a
            // "too much recursion" error.
            setTimeout(runIfPresent, 0, handle);
        } else {
            var task = tasksByHandle[handle];
            if (task) {
                currentlyRunningATask = true;
                try {
                    run(task);
                } finally {
                    clearImmediate(handle);
                    currentlyRunningATask = false;
                }
            }
        }
    }

    function installNextTickImplementation() {
        registerImmediate = function(handle) {
            process.nextTick(function () { runIfPresent(handle); });
        };
    }

    function canUsePostMessage() {
        // The test against `importScripts` prevents this implementation from being installed inside a web worker,
        // where `global.postMessage` means something completely different and can't be used for this purpose.
        if (global.postMessage && !global.importScripts) {
            var postMessageIsAsynchronous = true;
            var oldOnMessage = global.onmessage;
            global.onmessage = function() {
                postMessageIsAsynchronous = false;
            };
            global.postMessage("", "*");
            global.onmessage = oldOnMessage;
            return postMessageIsAsynchronous;
        }
    }

    function installPostMessageImplementation() {
        // Installs an event handler on `global` for the `message` event: see
        // * https://developer.mozilla.org/en/DOM/window.postMessage
        // * http://www.whatwg.org/specs/web-apps/current-work/multipage/comms.html#crossDocumentMessages

        var messagePrefix = "setImmediate$" + Math.random() + "$";
        var onGlobalMessage = function(event) {
            if (event.source === global &&
                typeof event.data === "string" &&
                event.data.indexOf(messagePrefix) === 0) {
                runIfPresent(+event.data.slice(messagePrefix.length));
            }
        };

        if (global.addEventListener) {
            global.addEventListener("message", onGlobalMessage, false);
        } else {
            global.attachEvent("onmessage", onGlobalMessage);
        }

        registerImmediate = function(handle) {
            global.postMessage(messagePrefix + handle, "*");
        };
    }

    function installMessageChannelImplementation() {
        var channel = new MessageChannel();
        channel.port1.onmessage = function(event) {
            var handle = event.data;
            runIfPresent(handle);
        };

        registerImmediate = function(handle) {
            channel.port2.postMessage(handle);
        };
    }

    function installReadyStateChangeImplementation() {
        var html = doc.documentElement;
        registerImmediate = function(handle) {
            // Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
            // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
            var script = doc.createElement("script");
            script.onreadystatechange = function () {
                runIfPresent(handle);
                script.onreadystatechange = null;
                html.removeChild(script);
                script = null;
            };
            html.appendChild(script);
        };
    }

    function installSetTimeoutImplementation() {
        registerImmediate = function(handle) {
            setTimeout(runIfPresent, 0, handle);
        };
    }

    // If supported, we should attach to the prototype of global, since that is where setTimeout et al. live.
    var attachTo = Object.getPrototypeOf && Object.getPrototypeOf(global);
    attachTo = attachTo && attachTo.setTimeout ? attachTo : global;

    // Don't get fooled by e.g. browserify environments.
    if ({}.toString.call(global.process) === "[object process]") {
        // For Node.js before 0.9
        installNextTickImplementation();

    } else if (canUsePostMessage()) {
        // For non-IE10 modern browsers
        installPostMessageImplementation();

    } else if (global.MessageChannel) {
        // For web workers, where supported
        installMessageChannelImplementation();

    } else if (doc && "onreadystatechange" in doc.createElement("script")) {
        // For IE 6–8
        installReadyStateChangeImplementation();

    } else {
        // For older browsers
        installSetTimeoutImplementation();
    }

    attachTo.setImmediate = setImmediate;
    attachTo.clearImmediate = clearImmediate;
}(typeof self === "undefined" ? typeof global === "undefined" ? this : global : self));

}).call(this)}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"_process":74}],8:[function(require,module,exports){
/*
	Seventh

	Copyright (c) 2017 - 2020 Cédric Ronvel

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



const Promise = require( './seventh.js' ) ;



function Queue( jobRunner , concurrency = 4 ) {
	this.jobRunner = jobRunner ;
	this.jobs = new Map() ;			// all jobs
	this.pendingJobs = new Map() ;	// only pending jobs (not run)
	this.runningJobs = new Map() ;	// only running jobs (not done)
	this.errorJobs = new Map() ;	// jobs that have failed
	this.jobsDone = new Map() ;		// jobs that finished successfully
	this.concurrency = + concurrency || 1 ;

	// Internal
	this.isQueueRunning = true ;
	this.isLoopRunning = false ;
	this.canLoopAgain = false ;
	this.ready = Promise.resolved ;

	// Misc
	this.startTime = null ;		// timestamp at the first time the loop is run
	this.endTime = null ;		// timestamp at the last time the loop exited

	// External API, resolved when there is no jobs anymore in the queue, a new Promise is created when new element are injected
	this.drained = Promise.resolved ;

	// External API, resolved when the Queue has nothing to do: either it's drained or the pending jobs have dependencies that cannot be solved
	this.idle = Promise.resolved ;
}

Promise.Queue = Queue ;



function Job( id , dependencies = null , data = undefined ) {
	this.id = id ;
	this.dependencies = dependencies === null ? null : [ ... dependencies ] ;
	this.data = data === undefined ? id : data ;
	this.error = null ;
	this.startTime = null ;
	this.endTime = null ;
}

Queue.Job = Job ;



Queue.prototype.setConcurrency = function( concurrency ) { this.concurrency = + concurrency || 1 ; } ;
Queue.prototype.stop = Queue.prototype.pause = function() { this.isQueueRunning = false ; } ;
Queue.prototype.has = function( id ) { return this.jobs.has( id ) ; } ;



Queue.prototype.add = Queue.prototype.addJob = function( id , data , dependencies = null ) {
	// Don't add it twice!
	if ( this.jobs.has( id ) ) { return false ; }

	var job = new Job( id , dependencies , data ) ;
	this.jobs.set( id , job ) ;
	this.pendingJobs.set( id , job ) ;
	this.canLoopAgain = true ;
	if ( this.isQueueRunning && ! this.isLoopRunning ) { this.run() ; }
	if ( this.drained.isSettled() ) { this.drained = new Promise() ; }
	return job ;
} ;



// Add a batch of jobs, with only id (data=id) and no dependencies
Queue.prototype.addBatch = Queue.prototype.addJobBatch = function( ids ) {
	var id , job ;

	for ( id of ids ) {
		// Don't add it twice!
		if ( this.jobs.has( id ) ) { return false ; }
		job = new Job( id ) ;
		this.jobs.set( id , job ) ;
		this.pendingJobs.set( id , job ) ;
	}

	this.canLoopAgain = true ;
	if ( this.isQueueRunning && ! this.isLoopRunning ) { this.run() ; }
	if ( this.drained.isSettled() ) { this.drained = new Promise() ; }
} ;



Queue.prototype.run = Queue.prototype.resume = async function() {
	var job ;

	this.isQueueRunning = true ;

	if ( this.isLoopRunning ) { return ; }
	this.isLoopRunning = true ;

	if ( ! this.startTime ) { this.startTime = Date.now() ; }

	do {
		this.canLoopAgain = false ;

		for ( job of this.pendingJobs.values() ) {
			if ( job.dependencies && job.dependencies.some( dependencyId => ! this.jobsDone.has( dependencyId ) ) ) { continue ; }
			// This should be done synchronously:
			if ( this.idle.isSettled() ) { this.idle = new Promise() ; }
			this.canLoopAgain = true ;

			await this.ready ;

			// Something has stopped the queue while we were awaiting.
			// This check MUST be done only after "await", before is potentially synchronous, and things only change concurrently during an "await"
			if ( ! this.isQueueRunning ) { this.finishRun() ; return ; }

			this.runJob( job ) ;
		}
	} while ( this.canLoopAgain ) ;

	this.finishRun() ;
} ;



// Finish current run
Queue.prototype.finishRun = function() {
	this.isLoopRunning = false ;

	if ( ! this.pendingJobs.size ) { this.drained.resolve() ; }

	if ( ! this.runningJobs.size ) {
		this.endTime = Date.now() ;
		this.idle.resolve() ;
	}
} ;



Queue.prototype.runJob = async function( job ) {
	// Immediately remove it synchronously from the pending queue and add it to the running one
	this.pendingJobs.delete( job.id ) ;
	this.runningJobs.set( job.id , job ) ;

	if ( this.runningJobs.size >= this.concurrency ) { this.ready = new Promise() ; }

	// Async part
	try {
		job.startTime = Date.now() ;
		await this.jobRunner( job.data ) ;
		job.endTime = Date.now() ;
		this.jobsDone.set( job.id , job ) ;
		this.canLoopAgain = true ;
	}
	catch ( error ) {
		job.endTime = Date.now() ;
		job.error = error ;
		this.errorJobs.set( job.id , job ) ;
	}

	this.runningJobs.delete( job.id ) ;
	if ( this.runningJobs.size < this.concurrency ) { this.ready.resolve() ; }

	// This MUST come last, because it retry the loop: dependencies may have been unlocked!
	if ( ! this.isLoopRunning ) {
		if ( this.isQueueRunning && this.pendingJobs.size ) { this.run() ; }
		else { this.finishRun() ; }
	}
} ;



Queue.prototype.getJobTimes = function() {
	var job , stats = {} ;
	for ( job of this.jobsDone.values() ) { stats[ job.id ] = job.endTime - job.startTime ; }
	return stats ;
} ;



Queue.prototype.getStats = function() {
	var job , sum = 0 ,
		stats = {
			pending: this.pendingJobs.size ,
			running: this.runningJobs.size ,
			failed: this.errorJobs.size ,
			done: this.jobsDone.size ,
			averageJobTime: null ,
			queueTime: null
		} ;

	if ( this.jobsDone.size ) {
		for ( job of this.jobsDone.values() ) { sum += job.endTime - job.startTime ; }
		stats.averageJobTime = sum / this.jobsDone.size ;
	}

	if ( this.endTime ) { stats.queueTime = this.endTime - this.startTime ; }

	return stats ;
} ;


},{"./seventh.js":15}],9:[function(require,module,exports){
/*
	Seventh

	Copyright (c) 2017 - 2020 Cédric Ronvel

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



const Promise = require( './seventh.js' ) ;



Promise.promisifyNodeApi = ( api , suffix , multiSuffix , filter , anything ) => {
	var keys ;

	suffix = suffix || 'Async' ;
	multiSuffix = multiSuffix || 'AsyncAll' ;
	filter = filter || ( key => key[ 0 ] !== '_' && ! key.endsWith( 'Sync' ) ) ;

	if ( anything ) {
		keys = [] ;

		for ( let key in api ) {
			if ( typeof api[ key ] === 'function' ) { keys.push( key ) ; }
		}
	}
	else {
		keys = Object.keys( api ) ;
	}

	keys.filter( key => {
		if ( typeof api[ key ] !== 'function' ) { return false ; }

		// If it has any enumerable properties on its prototype, it's a constructor
		for ( let trash in api[ key ].prototype ) { return false ; }

		return filter( key , api ) ;
	} )
		.forEach( key => {
			const targetKey = key + suffix ;
			const multiTargetKey = key + multiSuffix ;

			// Do nothing if it already exists
			if ( ! api[ targetKey ] ) {
				api[ targetKey ] = Promise.promisify( api[ key ] , api ) ;
			}

			if ( ! api[ multiTargetKey ] ) {
				api[ multiTargetKey ] = Promise.promisifyAll( api[ key ] , api ) ;
			}
		} ) ;
} ;



Promise.promisifyAnyNodeApi = ( api , suffix , multiSuffix , filter ) => {
	Promise.promisifyNodeApi( api , suffix , multiSuffix , filter , true ) ;
} ;



},{"./seventh.js":15}],10:[function(require,module,exports){
/*
	Seventh

	Copyright (c) 2017 - 2020 Cédric Ronvel

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



const Promise = require( './seventh.js' ) ;



// This object is used as a special unique value for array hole (see Promise.filter())
const HOLE = {} ;

function noop() {}



Promise.all = ( iterable ) => {
	var index = - 1 , settled = false ,
		count = 0 , length = Infinity ,
		value , values = [] ,
		allPromise = new Promise() ;

	for ( value of iterable ) {
		if ( settled ) { break ; }

		const promiseIndex = ++ index ;

		Promise.resolve( value )
			.then(
				value_ => {
					if ( settled ) { return ; }

					values[ promiseIndex ] = value_ ;
					count ++ ;

					if ( count >= length ) {
						settled = true ;
						allPromise._resolveValue( values ) ;
					}
				} ,
				error => {
					if ( settled ) { return ; }
					settled = true ;
					allPromise.reject( error ) ;
				}
			) ;
	}

	length = index + 1 ;

	if ( ! length ) {
		allPromise._resolveValue( values ) ;
	}

	return allPromise ;
} ;



// Maybe faster, but can't find any reasonable grounds for that ATM
//Promise.all =
Promise._allArray = ( iterable ) => {
	var length = iterable.length ;

	if ( ! length ) { Promise._resolveValue( [] ) ; }

	var index ,
		runtime = {
			settled: false ,
			count: 0 ,
			length: length ,
			values: [] ,
			allPromise: new Promise()
		} ;

	for ( index = 0 ; ! runtime.settled && index < length ; index ++ ) {
		Promise._allArrayOne( iterable[ index ] , index , runtime ) ;
	}

	return runtime.allPromise ;
} ;



// internal for allArray
Promise._allArrayOne = ( value , index , runtime ) => {
	Promise._bareThen( value ,
		value_ => {
			if ( runtime.settled ) { return ; }

			runtime.values[ index ] = value_ ;
			runtime.count ++ ;

			if ( runtime.count >= runtime.length ) {
				runtime.settled = true ;
				runtime.allPromise._resolveValue( runtime.values ) ;
			}
		} ,
		error => {
			if ( runtime.settled ) { return ; }
			runtime.settled = true ;
			runtime.allPromise.reject( error ) ;
		}
	) ;
} ;



Promise.allSettled = ( iterable ) => {
	var index = - 1 , settled = false ,
		count = 0 , length = Infinity ,
		value , values = [] ,
		allPromise = new Promise() ;

	for ( value of iterable ) {
		if ( settled ) { break ; }

		const promiseIndex = ++ index ;

		Promise.resolve( value )
			.then(
				value_ => {
					if ( settled ) { return ; }

					values[ promiseIndex ] = { status: 'fulfilled' , value: value_ } ;
					count ++ ;

					if ( count >= length ) {
						settled = true ;
						allPromise._resolveValue( values ) ;
					}
				} ,
				error => {
					if ( settled ) { return ; }

					values[ promiseIndex ] = { status: 'rejected' ,  reason: error } ;
					count ++ ;

					if ( count >= length ) {
						settled = true ;
						allPromise._resolveValue( values ) ;
					}
				}
			) ;
	}

	length = index + 1 ;

	if ( ! length ) {
		allPromise._resolveValue( values ) ;
	}

	return allPromise ;
} ;



// Promise.all() with an iterator
Promise.every =
Promise.map = ( iterable , iterator ) => {
	var index = - 1 , settled = false ,
		count = 0 , length = Infinity ,
		value , values = [] ,
		allPromise = new Promise() ;

	for ( value of iterable ) {
		if ( settled ) { break ; }

		const promiseIndex = ++ index ;

		Promise.resolve( value )
			.then( value_ => {
				if ( settled ) { return ; }
				return iterator( value_ , promiseIndex ) ;
			} )
			.then(
				value_ => {
					if ( settled ) { return ; }

					values[ promiseIndex ] = value_ ;
					count ++ ;

					if ( count >= length ) {
						settled = true ;
						allPromise._resolveValue( values ) ;
					}
				} ,
				error => {
					if ( settled ) { return ; }
					settled = true ;
					allPromise.reject( error ) ;
				}
			) ;
	}

	length = index + 1 ;

	if ( ! length ) {
		allPromise._resolveValue( values ) ;
	}

	return allPromise ;
} ;



/*
	It works symmetrically with Promise.all(), the resolve and reject logic are switched.
	Therefore, it resolves to the first resolving promise OR reject if all promises are rejected
	with, as a reason an AggregateError of all promise rejection reasons.
*/
Promise.any = ( iterable ) => {
	var index = - 1 , settled = false ,
		count = 0 , length = Infinity ,
		value ,
		errors = [] ,
		anyPromise = new Promise() ;

	for ( value of iterable ) {
		if ( settled ) { break ; }

		const promiseIndex = ++ index ;

		Promise.resolve( value )
			.then(
				value_ => {
					if ( settled ) { return ; }

					settled = true ;
					anyPromise._resolveValue( value_ ) ;
				} ,
				error => {
					if ( settled ) { return ; }

					errors[ promiseIndex ] = error ;
					count ++ ;

					if ( count >= length ) {
						settled = true ;
						anyPromise.reject( new AggregateError( errors ) , 'Promise.any(): All promises have rejected' ) ;
					}
				}
			) ;
	}

	length = index + 1 ;

	if ( ! length ) {
		anyPromise.reject( new RangeError( 'Promise.any(): empty array' ) ) ;
	}

	return anyPromise ;
} ;



// Like Promise.any() but with an iterator
Promise.some = ( iterable , iterator ) => {
	var index = - 1 , settled = false ,
		count = 0 , length = Infinity ,
		value ,
		errors = [] ,
		anyPromise = new Promise() ;

	for ( value of iterable ) {
		if ( settled ) { break ; }

		const promiseIndex = ++ index ;

		Promise.resolve( value )
			.then( value_ => {
				if ( settled ) { return ; }
				return iterator( value_ , promiseIndex ) ;
			} )
			.then(
				value_ => {
					if ( settled ) { return ; }

					settled = true ;
					anyPromise._resolveValue( value_ ) ;
				} ,
				error => {
					if ( settled ) { return ; }

					errors[ promiseIndex ] = error ;
					count ++ ;

					if ( count >= length ) {
						settled = true ;
						anyPromise.reject( new AggregateError( errors , 'Promise.some(): All promises have rejected' ) ) ;
					}
				}
			) ;
	}

	length = index + 1 ;

	if ( ! length ) {
		anyPromise.reject( new RangeError( 'Promise.some(): empty array' ) ) ;
	}

	return anyPromise ;
} ;



/*
	More closed to Array#filter().
	The iterator should return truthy if the array element should be kept,
	or falsy if the element should be filtered out.
	Any rejection reject the whole promise.
*/
Promise.filter = ( iterable , iterator ) => {
	var index = - 1 , settled = false ,
		count = 0 , length = Infinity ,
		value , values = [] ,
		filterPromise = new Promise() ;

	for ( value of iterable ) {
		if ( settled ) { break ; }

		const promiseIndex = ++ index ;

		Promise.resolve( value )
			.then( value_ => {
				if ( settled ) { return ; }
				values[ promiseIndex ] = value_ ;
				return iterator( value_ , promiseIndex ) ;
			} )
			.then(
				iteratorValue => {
					if ( settled ) { return ; }

					count ++ ;

					if ( ! iteratorValue ) { values[ promiseIndex ] = HOLE ; }

					if ( count >= length ) {
						settled = true ;
						values = values.filter( e => e !== HOLE ) ;
						filterPromise._resolveValue( values ) ;
					}
				} ,
				error => {
					if ( settled ) { return ; }
					settled = true ;
					filterPromise.reject( error ) ;
				}
			) ;
	}

	length = index + 1 ;

	if ( ! length ) {
		filterPromise._resolveValue( values ) ;
	}
	else if ( count >= length ) {
		settled = true ;
		values = values.filter( e => e !== HOLE ) ;
		filterPromise._resolveValue( values ) ;
	}

	return filterPromise ;
} ;



// forEach performs reduce as well, if a third argument is supplied
// Force a function statement because we are using arguments.length, so we can support accumulator equals to undefined
Promise.foreach =
Promise.forEach = function( iterable , iterator , accumulator ) {
	var index = - 1 ,
		isReduce = arguments.length >= 3 ,
		it = iterable[Symbol.iterator]() ,
		forEachPromise = new Promise() ,
		lastPromise = Promise.resolve( accumulator ) ;

	// The array-like may contains promises that could be rejected before being handled
	if ( Promise.warnUnhandledRejection ) { Promise._handleAll( iterable ) ; }

	var nextElement = () => {
		lastPromise.then(
			accumulator_ => {
				let { value , done } = it.next() ;
				index ++ ;

				if ( done ) {
					forEachPromise.resolve( accumulator_ ) ;
				}
				else {
					lastPromise = Promise.resolve( value ).then(
						isReduce ?
							value_ => iterator( accumulator_ , value_ , index ) :
							value_ => iterator( value_ , index )
					) ;

					nextElement() ;
				}
			} ,
			error => {
				forEachPromise.reject( error ) ;

				// We have to eat all remaining promise errors
				for ( ;; ) {
					let { value , done } = it.next() ;
					if ( done ) { break ; }

					//if ( ( value instanceof Promise ) || ( value instanceof NativePromise ) )
					if ( Promise.isThenable( value ) ) {
						value.then( noop , noop ) ;
					}
				}
			}
		) ;
	} ;

	nextElement() ;

	return forEachPromise ;
} ;



Promise.reduce = ( iterable , iterator , accumulator ) => {
	// Force 3 arguments
	return Promise.forEach( iterable , iterator , accumulator ) ;
} ;



/*
	Same than map, but iterate over an object and produce an object.
	Think of it as a kind of Object#map() (which of course does not exist).
*/
Promise.mapObject = ( inputObject , iterator ) => {
	var settled = false ,
		count = 0 ,
		keys = Object.keys( inputObject ) ,
		length = keys.length ,
		outputObject = {} ,
		mapPromise = new Promise() ;

	for ( let i = 0 ; ! settled && i < length ; i ++ ) {
		const key = keys[ i ] ;
		const value = inputObject[ key ] ;

		Promise.resolve( value )
			.then( value_ => {
				if ( settled ) { return ; }
				return iterator( value_ , key ) ;
			} )
			.then(
				value_ => {
					if ( settled ) { return ; }

					outputObject[ key ] = value_ ;
					count ++ ;

					if ( count >= length ) {
						settled = true ;
						mapPromise._resolveValue( outputObject ) ;
					}
				} ,
				error => {
					if ( settled ) { return ; }
					settled = true ;
					mapPromise.reject( error ) ;
				}
			) ;
	}

	if ( ! length ) {
		mapPromise._resolveValue( outputObject ) ;
	}

	return mapPromise ;
} ;



// Like map, but with a concurrency limit
Promise.concurrent = ( limit , iterable , iterator ) => {
	var index = - 1 , settled = false ,
		running = 0 ,
		count = 0 , length = Infinity ,
		value , done = false ,
		values = [] ,
		it = iterable[Symbol.iterator]() ,
		concurrentPromise = new Promise() ;

	// The array-like may contains promises that could be rejected before being handled
	if ( Promise.warnUnhandledRejection ) { Promise._handleAll( iterable ) ; }

	limit = + limit || 1 ;

	const runBatch = () => {
		while ( ! done && running < limit ) {

			//console.log( "Pre" , index ) ;
			( { value , done } = it.next() ) ;

			if ( done ) {
				length = index + 1 ;

				if ( count >= length ) {
					settled = true ;
					concurrentPromise._resolveValue( values ) ;
					return ;
				}
				break ;
			}

			if ( settled ) { break ; }

			const promiseIndex = ++ index ;
			running ++ ;
			//console.log( "Launch" , promiseIndex ) ;

			Promise.resolve( value )
				.then( value_ => {
					if ( settled ) { return ; }
					return iterator( value_ , promiseIndex ) ;
				} )
				.then(
					value_ => {
					//console.log( "Done" , promiseIndex , value_ ) ;
						if ( settled ) { return ; }

						values[ promiseIndex ] = value_ ;
						count ++ ;
						running -- ;

						//console.log( "count/length" , count , length ) ;
						if ( count >= length ) {
							settled = true ;
							concurrentPromise._resolveValue( values ) ;
							return ;
						}

						if ( running < limit ) {
							runBatch() ;
							return ;
						}
					} ,
					error => {
						if ( settled ) { return ; }
						settled = true ;
						concurrentPromise.reject( error ) ;
					}
				) ;
		}
	} ;

	runBatch() ;

	if ( index < 0 ) {
		concurrentPromise._resolveValue( values ) ;
	}

	return concurrentPromise ;
} ;



/*
	Like native Promise.race(), it is hanging forever if the array is empty.
	It resolves or rejects to the first resolved/rejected promise.
*/
Promise.race = ( iterable ) => {
	var settled = false ,
		value ,
		racePromise = new Promise() ;

	for ( value of iterable ) {
		if ( settled ) { break ; }

		Promise.resolve( value )
			.then(
				value_ => {
					if ( settled ) { return ; }

					settled = true ;
					racePromise._resolveValue( value_ ) ;
				} ,
				error => {
					if ( settled ) { return ; }

					settled = true ;
					racePromise.reject( error ) ;
				}
			) ;
	}

	return racePromise ;
} ;


},{"./seventh.js":15}],11:[function(require,module,exports){
(function (process,global,setImmediate){(function (){
/*
	Seventh

	Copyright (c) 2017 - 2020 Cédric Ronvel

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



/*
	Prerequisite.
*/



const NativePromise = global.Promise ;

// Cross-platform next tick function
var nextTick ;

if ( ! process.browser ) {
	nextTick = process.nextTick ;
}
else {
	// Browsers suck, they don't have setImmediate() except IE/Edge.
	// A module is needed to emulate it.
	require( 'setimmediate' ) ;
	nextTick = setImmediate ;
}



/*
	Constructor.
*/



function Promise( fn ) {
	this.fn = fn ;
	this._then = Promise._dormantThen ;
	this.value = null ;
	this.thenHandlers = null ;
	this.handledRejection = null ;

	if ( this.fn ) {
		this._exec() ;
	}
}

module.exports = Promise ;



Promise.Native = NativePromise ;
Promise.warnUnhandledRejection = true ;
Promise.nextTick = nextTick ;



Promise.prototype._exec = function() {
	this._then = Promise._pendingThen ;

	try {
		this.fn(
			// Don't return anything, it would create nasty bugs! E.g.:
			// bad: error => this.reject( error_ )
			// good: error_ => { this.reject( error_ ) ; }
			result_ => { this.resolve( result_ ) ; } ,
			error_ => { this.reject( error_ ) ; }
		) ;
	}
	catch ( error ) {
		this.reject( error ) ;
	}
} ;



/*
	Resolve/reject and then-handlers management.
*/



Promise.prototype.resolve = Promise.prototype.fulfill = function( value ) {
	// Throw an error?
	if ( this._then.settled ) { return this ; }

	if ( Promise.isThenable( value ) ) {
		this._execThenPromise( value ) ;
		return this ;
	}

	return this._resolveValue( value ) ;
} ;



Promise.prototype._resolveValue = function( value ) {
	this._then = Promise._fulfilledThen ;
	this.value = value ;
	if ( this.thenHandlers && this.thenHandlers.length ) { this._execFulfillHandlers() ; }

	return this ;
} ;



// Faster on node v8.x
Promise.prototype._execThenPromise = function( thenPromise ) {
	try {
		thenPromise.then(
			result_ => { this.resolve( result_ ) ; } ,
			error_ => { this.reject( error_ ) ; }
		) ;
	}
	catch ( error ) {
		this.reject( error ) ;
	}
} ;



Promise.prototype.reject = function( error ) {
	// Throw an error?
	if ( this._then.settled ) { return this ; }

	this._then = Promise._rejectedThen ;
	this.value = error ;

	if ( this.thenHandlers && this.thenHandlers.length ) {
		this._execRejectionHandlers() ;
	}
	else if ( Promise.warnUnhandledRejection && ! this.handledRejection ) {
		this._unhandledRejection() ;
	}

	return this ;
} ;



Promise.prototype._execFulfillHandlers = function() {
	var i ,
		length = this.thenHandlers.length ;

	// Do cache the length, if a handler is synchronously added, it will be called on next tick
	for ( i = 0 ; i < length ; i += 3 ) {
		if ( this.thenHandlers[ i + 1 ] ) {
			this._execOneFulfillHandler( this.thenHandlers[ i ] , this.thenHandlers[ i + 1 ] ) ;
		}
		else {
			this.thenHandlers[ i ].resolve( this.value ) ;
		}
	}
} ;



// Faster on node v8.x?
//*
Promise.prototype._execOneFulfillHandler = function( promise , onFulfill ) {
	try {
		promise.resolve( onFulfill( this.value ) ) ;
	}
	catch ( error_ ) {
		promise.reject( error_ ) ;
	}
} ;
//*/



Promise.prototype._execRejectionHandlers = function() {
	var i ,
		length = this.thenHandlers.length ;

	// Do cache the length, if a handler is synchronously added, it will be called on next tick
	for ( i = 0 ; i < length ; i += 3 ) {
		if ( this.thenHandlers[ i + 2 ] ) {
			this._execOneRejectHandler( this.thenHandlers[ i ] , this.thenHandlers[ i + 2 ] ) ;
		}
		else {
			this.thenHandlers[ i ].reject( this.value ) ;
		}
	}
} ;



// Faster on node v8.x?
//*
Promise.prototype._execOneRejectHandler = function( promise , onReject ) {
	try {
		promise.resolve( onReject( this.value ) ) ;
	}
	catch ( error_ ) {
		promise.reject( error_ ) ;
	}
} ;
//*/



Promise.prototype.resolveTimeout = Promise.prototype.fulfillTimeout = function( time , result ) {
	setTimeout( () => this.resolve( result ) , time ) ;
} ;



Promise.prototype.rejectTimeout = function( time , error ) {
	setTimeout( () => this.reject( error ) , time ) ;
} ;



Promise.prototype.resolveNextTick = Promise.prototype.fulfillNextTick = function( result ) {
	nextTick( () => this.resolve( result ) ) ;
} ;



Promise.prototype.rejectNextTick = function( error ) {
	nextTick( () => this.reject( error ) ) ;
} ;



/*
	.then() variants depending on the state
*/



// .then() variant when the promise is dormant
Promise._dormantThen = function( onFulfill , onReject ) {
	if ( this.fn ) {
		// If this is a dormant promise, wake it up now!
		this._exec() ;

		// Return now, some sync stuff can change the status
		return this._then( onFulfill , onReject ) ;
	}

	var promise = new Promise() ;

	if ( ! this.thenHandlers ) {
		this.thenHandlers = [ promise , onFulfill , onReject ] ;
	}
	else {
		//this.thenHandlers.push( onFulfill ) ;
		this.thenHandlers[ this.thenHandlers.length ] = promise ;
		this.thenHandlers[ this.thenHandlers.length ] = onFulfill ;
		this.thenHandlers[ this.thenHandlers.length ] = onReject ;
	}

	return promise ;
} ;

Promise._dormantThen.settled = false ;



// .then() variant when the promise is pending
Promise._pendingThen = function( onFulfill , onReject ) {
	var promise = new Promise() ;

	if ( ! this.thenHandlers ) {
		this.thenHandlers = [ promise , onFulfill , onReject ] ;
	}
	else {
		//this.thenHandlers.push( onFulfill ) ;
		this.thenHandlers[ this.thenHandlers.length ] = promise ;
		this.thenHandlers[ this.thenHandlers.length ] = onFulfill ;
		this.thenHandlers[ this.thenHandlers.length ] = onReject ;
	}

	return promise ;
} ;

Promise._pendingThen.settled = false ;



// .then() variant when the promise is fulfilled
Promise._fulfilledThen = function( onFulfill ) {
	if ( ! onFulfill ) { return this ; }

	var promise = new Promise() ;

	// This handler should not fire in this code sync flow
	nextTick( () => {
		try {
			promise.resolve( onFulfill( this.value ) ) ;
		}
		catch ( error ) {
			promise.reject( error ) ;
		}
	} ) ;

	return promise ;
} ;

Promise._fulfilledThen.settled = true ;



// .then() variant when the promise is rejected
Promise._rejectedThen = function( onFulfill , onReject ) {
	if ( ! onReject ) { return this ; }

	this.handledRejection = true ;
	var promise = new Promise() ;

	// This handler should not fire in this code sync flow
	nextTick( () => {
		try {
			promise.resolve( onReject( this.value ) ) ;
		}
		catch ( error ) {
			promise.reject( error ) ;
		}
	} ) ;

	return promise ;
} ;

Promise._rejectedThen.settled = true ;



/*
	.then() and short-hands.
*/



Promise.prototype.then = function( onFulfill , onReject ) {
	return this._then( onFulfill , onReject ) ;
} ;



Promise.prototype.catch = function( onReject = () => undefined ) {
	return this._then( undefined , onReject ) ;
} ;



Promise.prototype.finally = function( onSettled ) {
	return this._then( onSettled , onSettled ) ;
} ;



Promise.prototype.tap = Promise.prototype.tapThen = function( onFulfill ) {
	this._then( onFulfill , undefined ) ;
	return this ;
} ;



Promise.prototype.tapCatch = function( onReject ) {
	this._then( undefined , onReject ) ;
	return this ;
} ;



Promise.prototype.tapFinally = function( onSettled ) {
	this._then( onSettled , onSettled ) ;
	return this ;
} ;



// Any unhandled error throw ASAP
Promise.prototype.fatal = function() {
	this._then( undefined , error => {
		// Throw async, otherwise it would be catched by .then()
		nextTick( () => { throw error ; } ) ;
	} ) ;
} ;



Promise.prototype.done = function( onFulfill , onReject ) {
	this._then( onFulfill , onReject ).fatal() ;
	return this ;
} ;



Promise.prototype.callback = function( cb ) {
	this._then(
		value => { cb( undefined , value ) ; } ,
		error => { cb( error ) ; }
	).fatal() ;

	return this ;
} ;



Promise.prototype.callbackAll = function( cb ) {
	this._then(
		values => {
			if ( Array.isArray( values ) ) { cb( undefined , ... values ) ; }
			else { cb( undefined , values ) ; }
		} ,
		error => { cb( error ) ; }
	).fatal() ;

	return this ;
} ;



/*
	The reverse of .callback(), it calls the function with a callback argument and return a promise that resolve or reject depending on that callback invocation.
	Usage:
		await Promise.callback( callback => myFunctionRelyingOnCallback( [arg1] , [arg2] , [...] , callback ) ;
*/
Promise.callback = function( fn ) {
	return new Promise( ( resolve , reject ) => {
		fn( ( error , arg ) => {
			if ( error ) { reject( error ) ; }
			else { resolve( arg ) ; }
		} ) ;
	} ) ;
} ;



Promise.callbackAll = function( fn ) {
	return new Promise( ( resolve , reject ) => {
		fn( ( error , ... args ) => {
			if ( error ) { reject( error ) ; }
			else { resolve( args ) ; }
		} ) ;
	} ) ;
} ;



Promise.prototype.toPromise =	// <-- DEPRECATED, use .propagate
Promise.prototype.propagate = function( promise ) {
	this._then(
		value => { promise.resolve( value ) ; } ,
		error => { promise.reject( error ) ; }
	) ;

	return this ;
} ;





/*
	Foreign promises facilities
*/



Promise.propagate = function( foreignPromise , promise ) {
	foreignPromise.then(
		value => { promise.resolve( value ) ; } ,
		error => { promise.reject( error ) ; }
	) ;

	return foreignPromise ;
} ;



Promise.finally = function( foreignPromise , onSettled ) {
	return foreignPromise.then( onSettled , onSettled ) ;
} ;





/*
	Static factories.
*/



Promise.resolve = Promise.fulfill = function( value ) {
	if ( Promise.isThenable( value ) ) { return Promise.fromThenable( value ) ; }
	return Promise._resolveValue( value ) ;
} ;



Promise._resolveValue = function( value ) {
	var promise = new Promise() ;
	promise._then = Promise._fulfilledThen ;
	promise.value = value ;
	return promise ;
} ;



Promise.reject = function( error ) {
	//return new Promise().reject( error ) ;
	var promise = new Promise() ;
	promise._then = Promise._rejectedThen ;
	promise.value = error ;
	return promise ;
} ;



Promise.resolveTimeout = Promise.fulfillTimeout = function( timeout , value ) {
	return new Promise( resolve => setTimeout( () => resolve( value ) , timeout ) ) ;
} ;



Promise.rejectTimeout = function( timeout , error ) {
	return new Promise( ( resolve , reject ) => setTimeout( () => reject( error ) , timeout ) ) ;
} ;



Promise.resolveNextTick = Promise.fulfillNextTick = function( value ) {
	return new Promise( resolve => nextTick( () => resolve( value ) ) ) ;
} ;



Promise.rejectNextTick = function( error ) {
	return new Promise( ( resolve , reject ) => nextTick( () => reject( error ) ) ) ;
} ;



// A dormant promise is activated the first time a then handler is assigned
Promise.dormant = function( fn ) {
	var promise = new Promise() ;
	promise.fn = fn ;
	return promise ;
} ;



// Try-catched Promise.resolve( fn() )
Promise.try = function( fn ) {
	try {
		return Promise.resolve( fn() ) ;
	}
	catch ( error ) {
		return Promise.reject( error ) ;
	}
} ;



/*
	Thenables.
*/



Promise.isThenable = function( value ) {
	return value && typeof value === 'object' && typeof value.then === 'function' ;
} ;



// We assume a thenable object here
Promise.fromThenable = function( thenable ) {
	if ( thenable instanceof Promise ) { return thenable ; }

	return new Promise( ( resolve , reject ) => {
		thenable.then(
			value => { resolve( value ) ; } ,
			error => { reject( error ) ; }
		) ;
	} ) ;
} ;



// When you just want a fast then() function out of anything, without any desync and unchainable
Promise._bareThen = function( value , onFulfill , onReject ) {
	//if ( Promise.isThenable( value ) )
	if( value && typeof value === 'object' ) {
		if ( value instanceof Promise ) {
			if ( value._then === Promise._fulfilledThen ) { onFulfill( value.value ) ; }
			else if ( value._then === Promise._rejectedThen ) { onReject( value.value ) ; }
			else { value._then( onFulfill , onReject ) ; }
		}
		else if ( typeof value.then === 'function' ) {
			value.then( onFulfill , onReject ) ;
		}
		else {
			onFulfill( value ) ;
		}
	}
	else {
		onFulfill( value ) ;
	}
} ;



/*
	Misc.
*/



// Internal usage, mark all promises as handled ahead of time, useful for series,
// because a warning would be displayed for unhandled rejection for promises that are not yet processed.
Promise._handleAll = function( iterable ) {
	var value ;

	for ( value of iterable ) {
		//if ( ( value instanceof Promise ) || ( value instanceof NativePromise ) )
		if ( Promise.isThenable( value ) ) {
			value.handledRejection = true ;
		}
	}
} ;



Promise.prototype._unhandledRejection = function() {
	// This promise is currently unhandled
	// If still unhandled at the end of the synchronous block of code,
	// output an error message.

	this.handledRejection = false ;

	// Don't know what is the correct way to inform node.js about that.
	// There is no doc about that, and emitting unhandledRejection,
	// does not produce what is expected.

	//process.emit( 'unhandledRejection' , this.value , this ) ;

	/*
	nextTick( () => {
		if ( this.handledRejection === false )
		{
			process.emit( 'unhandledRejection' , this.value , this ) ;
		}
	} ) ;
	*/

	// It looks like 'await' inside a 'try-catch' does not handle the promise soon enough -_-'
	//const nextTick_ = nextTick ;
	const nextTick_ = cb => setTimeout( cb , 0 ) ;

	//*
	if ( this.value instanceof Error ) {
		nextTick_( () => {
			if ( this.handledRejection === false ) {
				this.value.message = 'Unhandled promise rejection: ' + this.value.message ;
				console.error( this.value ) ;
			}
		} ) ;
	}
	else {
		// Avoid starting the stack trace in the nextTick()...
		let error_ = new Error( 'Unhandled promise rejection' ) ;
		nextTick_( () => {
			if ( this.handledRejection === false ) {
				console.error( error_ ) ;
				console.error( 'Rejection reason:' , this.value ) ;
			}
		} ) ;
	}
	//*/
} ;



Promise.prototype.isSettled = function() { return this._then.settled ; } ;



Promise.prototype.getStatus = function() {
	switch ( this._then ) {
		case Promise._dormantThen :
			return 'dormant' ;
		case Promise._pendingThen :
			return 'pending' ;
		case Promise._fulfilledThen :
			return 'fulfilled' ;
		case Promise._rejectedThen :
			return 'rejected' ;
	}
} ;



Promise.prototype.inspect = function() {
	switch ( this._then ) {
		case Promise._dormantThen :
			return 'Promise { <DORMANT> }' ;
		case Promise._pendingThen :
			return 'Promise { <PENDING> }' ;
		case Promise._fulfilledThen :
			return 'Promise { <FULFILLED> ' + this.value + ' }' ;
		case Promise._rejectedThen :
			return 'Promise { <REJECTED> ' + this.value + ' }' ;
	}
} ;



// A shared dummy promise, when you just want to return an immediately thenable
Promise.resolved = Promise.dummy = Promise.resolve() ;





/*
	Browser specific.
*/



if ( process.browser ) {
	Promise.prototype.resolveAtAnimationFrame = function( value ) {
		window.requestAnimationFrame( () => this.resolve( value ) ) ;
	} ;

	Promise.prototype.rejectAtAnimationFrame = function( error ) {
		window.requestAnimationFrame( () => this.reject( error ) ) ;
	} ;

	Promise.resolveAtAnimationFrame = function( value ) {
		return new Promise( resolve => window.requestAnimationFrame( () => resolve( value ) ) ) ;
	} ;

	Promise.rejectAtAnimationFrame = function( error ) {
		return new Promise( ( resolve , reject ) => window.requestAnimationFrame( () => reject( error ) ) ) ;
	} ;
}


}).call(this)}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("timers").setImmediate)
},{"_process":74,"setimmediate":7,"timers":76}],12:[function(require,module,exports){
/*
	Seventh

	Copyright (c) 2017 - 2020 Cédric Ronvel

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



const Promise = require( './seventh.js' ) ;
const noop = () => undefined ;



Promise.promisifyAll = ( nodeAsyncFn , thisBinding ) => {
	// Little optimization here to have a promisified function as fast as possible
	if ( thisBinding ) {
		return ( ... args ) => {
			return new Promise( ( resolve , reject ) => {
				nodeAsyncFn.call( thisBinding , ... args , ( error , ... cbArgs ) => {
					if ( error ) {
						if ( cbArgs.length && error instanceof Error ) { error.args = cbArgs ; }
						reject( error ) ;
					}
					else {
						resolve( cbArgs ) ;
					}
				} ) ;
			} ) ;
		} ;
	}

	return function( ... args ) {
		return new Promise( ( resolve , reject ) => {
			nodeAsyncFn.call( this , ... args , ( error , ... cbArgs ) => {
				if ( error ) {
					if ( cbArgs.length && error instanceof Error ) { error.args = cbArgs ; }
					reject( error ) ;
				}
				else {
					resolve( cbArgs ) ;
				}
			} ) ;
		} ) ;
	} ;

} ;



// Same than .promisifyAll() but only return the callback args #1 instead of an array of args from #1 to #n
Promise.promisify = ( nodeAsyncFn , thisBinding ) => {
	// Little optimization here to have a promisified function as fast as possible
	if ( thisBinding ) {
		return ( ... args ) => {
			return new Promise( ( resolve , reject ) => {
				nodeAsyncFn.call( thisBinding , ... args , ( error , cbArg ) => {
					if ( error ) {
						if ( cbArg !== undefined && error instanceof Error ) { error.arg = cbArg ; }
						reject( error ) ;
					}
					else {
						resolve( cbArg ) ;
					}
				} ) ;
			} ) ;
		} ;
	}

	return function( ... args ) {
		return new Promise( ( resolve , reject ) => {
			nodeAsyncFn.call( this , ... args , ( error , cbArg ) => {
				if ( error ) {
					if ( cbArg !== undefined && error instanceof Error ) { error.arg = cbArg ; }
					reject( error ) ;
				}
				else {
					resolve( cbArg ) ;
				}
			} ) ;
		} ) ;
	} ;
} ;



/*
	Intercept each decoratee resolve/reject.
*/
Promise.interceptor = ( asyncFn , interceptor , errorInterceptor , thisBinding ) => {
	if ( typeof errorInterceptor !== 'function' ) {
		thisBinding = errorInterceptor ;
		errorInterceptor = noop ;
	}

	return function( ... args ) {
		var localThis = thisBinding || this ,
			maybePromise = asyncFn.call( localThis , ... args ) ;

		Promise.resolve( maybePromise ).then(
			value => interceptor.call( localThis , value ) ,
			error => errorInterceptor.call( localThis , error )
		) ;

		return maybePromise ;
	} ;
} ;



/*
	Run only once, return always the same promise.
*/
Promise.once = ( asyncFn , thisBinding ) => {
	var functionInstance = null ,	// instance when not called as an object's method but a regular function ('this' is undefined)
		instanceMap = new WeakMap() ;

	const getInstance = ( localThis ) => {
		var instance = localThis ? instanceMap.get( localThis ) : functionInstance ;
		if ( instance ) { return instance ; }

		instance = {
			triggered: false ,
			result: undefined
		} ;

		if ( localThis ) { instanceMap.set( localThis , instance ) ; }
		else { functionInstance = instance ; }

		return instance ;
	} ;

	return function( ... args ) {
		var localThis = thisBinding || this ,
			instance = getInstance( localThis ) ;

		if ( ! instance.triggered ) {
			instance.triggered = true ;
			instance.result = asyncFn.call( localThis , ... args ) ;
		}

		return instance.result ;
	} ;
} ;



/*
	The decoratee execution does not overlap, multiple calls are serialized.
*/
Promise.serialize = ( asyncFn , thisBinding ) => {
	var functionInstance = null ,	// instance when not called as an object's method but a regular function ('this' is undefined)
		instanceMap = new WeakMap() ;

	const getInstance = ( localThis ) => {
		var instance = localThis ? instanceMap.get( localThis ) : functionInstance ;
		if ( instance ) { return instance ; }

		instance = { lastPromise: Promise.resolve() } ;

		if ( localThis ) { instanceMap.set( localThis , instance ) ; }
		else { functionInstance = instance ; }

		return instance ;
	} ;

	return function( ... args ) {
		var localThis = thisBinding || this ,
			instance = getInstance( localThis ) ,
			promise = new Promise() ;

		instance.lastPromise.finally( () => {
			Promise.propagate( asyncFn.call( localThis , ... args ) , promise ) ;
		} ) ;

		instance.lastPromise = promise ;

		return promise ;
	} ;
} ;



/*
	It does nothing if the decoratee is still in progress, but it returns the promise of the action in progress.
*/
Promise.debounce = ( asyncFn , thisBinding ) => {
	var functionInstance = null ,	// instance when not called as an object's method but a regular function ('this' is undefined)
		instanceMap = new WeakMap() ;

	const getInstance = ( localThis ) => {
		var instance = localThis ? instanceMap.get( localThis ) : functionInstance ;
		if ( instance ) { return instance ; }

		instance = { inProgress: null } ;

		if ( localThis ) { instanceMap.set( localThis , instance ) ; }
		else { functionInstance = instance ; }

		return instance ;
	} ;

	return function( ... args ) {
		var localThis = thisBinding || this ,
			instance = getInstance( localThis ) ;

		if ( instance.inProgress ) { return instance.inProgress ; }

		let inProgress = instance.inProgress = asyncFn.call( localThis , ... args ) ;
		Promise.finally( inProgress , () => instance.inProgress = null ) ;
		return inProgress ;
	} ;
} ;



/*
	Like .debounce(), but subsequent call continue to return the last promise for some extra time after it resolved.
*/
Promise.debounceDelay = ( delay , asyncFn , thisBinding ) => {
	var functionInstance = null ,	// instance when not called as an object's method but a regular function ('this' is undefined)
		instanceMap = new WeakMap() ;

	const getInstance = ( localThis ) => {
		var instance = localThis ? instanceMap.get( localThis ) : functionInstance ;
		if ( instance ) { return instance ; }

		instance = { inProgress: null } ;

		if ( localThis ) { instanceMap.set( localThis , instance ) ; }
		else { functionInstance = instance ; }

		return instance ;
	} ;

	return function( ... args ) {
		var localThis = thisBinding || this ,
			instance = getInstance( localThis ) ;

		if ( instance.inProgress ) { return instance.inProgress ; }

		let inProgress = instance.inProgress = asyncFn.call( localThis , ... args ) ;
		Promise.finally( inProgress , () => setTimeout( () => instance.inProgress = null , delay ) ) ;
		return inProgress ;
	} ;
} ;



/*
	debounceNextTick( [asyncFn|syncFn] , thisBinding ) => {

	It does nothing until the next tick.
	The decoratee is called only once with the arguments of the last decorator call.
	The function argument can be sync or async.

	The use case is can be some niche case of .update()/.refresh()/.redraw() functions.
*/
Promise.debounceNextTick = ( asyncFn , thisBinding ) => {
	var inWrapper = null ,
		outWrapper = null ,
		waitFn = null ,
		functionInstance = null ,	// instance when not called as an object's method but a regular function ('this' is undefined)
		instanceMap = new WeakMap() ;

	const getInstance = ( localThis ) => {
		var instance = localThis ? instanceMap.get( localThis ) : functionInstance ;
		if ( instance ) { return instance ; }

		instance = {
			inProgress: null ,
			waitingNextTick: false ,
			currentUpdateWith: null ,
			currentUpdatePromise: null ,
			nextUpdateWith: null ,
			nextUpdatePromise: null
		} ;

		if ( localThis ) { instanceMap.set( localThis , instance ) ; }
		else { functionInstance = instance ; }

		return instance ;
	} ;


	const nextUpdate = function() {
		var instance = getInstance( this ) ;
		instance.inProgress = instance.currentUpdatePromise = null ;

		if ( instance.nextUpdateWith ) {
			let args = instance.nextUpdateWith ;
			instance.nextUpdateWith = null ;
			let sharedPromise = instance.nextUpdatePromise ;
			instance.nextUpdatePromise = null ;

			instance.inProgress = inWrapper.call( this , args ) ;
			// Forward the result to the pending promise
			Promise.propagate( instance.inProgress , sharedPromise ) ;
		}
	} ;


	inWrapper = function( args ) {
		var instance = getInstance( this ) ;

		instance.inProgress = new Promise() ;
		instance.currentUpdateWith = args ;
		instance.waitingNextTick = true ;

		Promise.nextTick( () => {
			instance.waitingNextTick = false ;
			let maybePromise = asyncFn.call( this , ... instance.currentUpdateWith ) ;

			if ( Promise.isThenable( maybePromise ) ) {
				instance.currentUpdatePromise = maybePromise ;
				Promise.finally( maybePromise , nextUpdate.bind( this ) ) ;
				Promise.propagate( maybePromise , instance.inProgress ) ;
			}
			else {
				// the function was synchronous
				instance.currentUpdatePromise = null ;
				instance.inProgress.resolve( maybePromise ) ;
				nextUpdate.call( this ) ;
			}
		} ) ;

		return instance.inProgress ;
	} ;

	return function( ... args ) {
		var localThis = thisBinding || this ,
			instance = getInstance( localThis ) ;

		if ( instance.waitingNextTick ) {
			instance.currentUpdateWith = args ;
			return instance.inProgress ;
		}

		if ( instance.currentUpdatePromise ) {
			if ( ! instance.nextUpdatePromise ) { instance.nextUpdatePromise = new Promise() ; }
			instance.nextUpdateWith = args ;
			return instance.nextUpdatePromise ;
		}

		return inWrapper.call( localThis , args ) ;
	} ;
} ;



/*
	debounceUpdate( [options] , asyncFn , thisBinding ) => {

	It does nothing if the decoratee is still in progress.
	Instead, the decoratee is called again after finishing once and only once, if it was tried one or more time during its progress.
	In case of multiple calls, the arguments of the last call will be used.

	The use case is .update()/.refresh()/.redraw() functions.

	If 'options' is given, it is an object, with:
		* delay: `number` a delay before calling again the decoratee
		* delayFn: async `function` called before calling again the decoratee
		* waitFn: async `function` called before calling the decoratee (even the first try), use-case: Window.requestAnimationFrame()
*/
Promise.debounceUpdate = ( options , asyncFn , thisBinding ) => {
	var inWrapper = null ,
		outWrapper = null ,
		delay = 0 ,
		delayFn = null ,
		waitFn = null ,
		functionInstance = null ,	// instance when not called as an object's method but a regular function ('this' is undefined)
		instanceMap = new WeakMap() ;

	// Manage arguments
	if ( typeof options === 'function' ) {
		thisBinding = asyncFn ;
		asyncFn = options ;
	}
	else {
		if ( typeof options.delay === 'number' ) { delay = options.delay ; }
		if ( typeof options.delayFn === 'function' ) { delayFn = options.delayFn ; }

		if ( options.waitNextTick ) { waitFn = Promise.resolveNextTick ; }
		else if ( typeof options.waitFn === 'function' ) { waitFn = options.waitFn ; }
	}


	const getInstance = ( localThis ) => {
		var instance = localThis ? instanceMap.get( localThis ) : functionInstance ;
		if ( instance ) { return instance ; }

		instance = {
			inProgress: null ,
			waitInProgress: null ,
			currentUpdateWith: null ,
			currentUpdatePromise: null ,
			nextUpdateWith: null ,
			nextUpdatePromise: null
		} ;

		if ( localThis ) { instanceMap.set( localThis , instance ) ; }
		else { functionInstance = instance ; }

		return instance ;
	} ;


	const nextUpdate = function() {
		var instance = getInstance( this ) ;
		instance.inProgress = instance.currentUpdatePromise = null ;

		if ( instance.nextUpdateWith ) {
			let args = instance.nextUpdateWith ;
			instance.nextUpdateWith = null ;
			let sharedPromise = instance.nextUpdatePromise ;
			instance.nextUpdatePromise = null ;

			instance.inProgress = inWrapper.call( this , args ) ;
			// Forward the result to the pending promise
			Promise.propagate( instance.inProgress , sharedPromise ) ;
		}
	} ;


	// Build outWrapper
	if ( delayFn ) {
		outWrapper = function() {
			delayFn().then( nextUpdate.bind( this ) ) ;
		} ;
	}
	else if ( delay ) {
		outWrapper = function() {
			setTimeout( nextUpdate.bind( this ) , delay ) ;
		} ;
	}
	else {
		outWrapper = nextUpdate ;
	}


	if ( waitFn ) {
		inWrapper = function( args ) {
			var instance = getInstance( this ) ;

			instance.inProgress = new Promise() ;
			instance.currentUpdateWith = args ;
			instance.waitInProgress = waitFn() ;

			Promise.finally( instance.waitInProgress , () => {
				instance.waitInProgress = null ;
				instance.currentUpdatePromise = asyncFn.call( this , ... instance.currentUpdateWith ) ;
				Promise.finally( instance.currentUpdatePromise , outWrapper.bind( this ) ) ;
				Promise.propagate( instance.currentUpdatePromise , instance.inProgress ) ;
			} ) ;

			return instance.inProgress ;
		} ;

		return function( ... args ) {
			var localThis = thisBinding || this ,
				instance = getInstance( localThis ) ;

			if ( instance.waitInProgress ) {
				instance.currentUpdateWith = args ;
				return instance.inProgress ;
			}

			if ( instance.currentUpdatePromise ) {
				if ( ! instance.nextUpdatePromise ) { instance.nextUpdatePromise = new Promise() ; }
				instance.nextUpdateWith = args ;
				return instance.nextUpdatePromise ;
			}

			return inWrapper.call( localThis , args ) ;
		} ;
	}


	// Variant without a waitFn

	inWrapper = function( args ) {
		var instance = getInstance( this ) ;

		instance.inProgress = asyncFn.call( this , ... args ) ;
		Promise.finally( instance.inProgress , outWrapper.bind( this ) ) ;
		return instance.inProgress ;
	} ;

	return function( ... args ) {
		var localThis = thisBinding || this ,
			instance = getInstance( localThis ) ;

		if ( instance.inProgress ) {
			if ( ! instance.nextUpdatePromise ) { instance.nextUpdatePromise = new Promise() ; }
			instance.nextUpdateWith = args ;
			return instance.nextUpdatePromise ;
		}

		return inWrapper.call( localThis , args ) ;
	} ;
} ;



// Used to ensure that the sync is done immediately if not busy
Promise.NO_DELAY = {} ;

// Used to ensure that the sync is done immediately if not busy, but for the first of a batch
Promise.BATCH_NO_DELAY = {} ;

/*
	Debounce for synchronization algorithm.
	Get two functions, one for getting from upstream, one for a full sync with upstream (getting AND updating).
	No operation overlap for a given resourceId.
	Depending on the configuration, it is either like .debounce() or like .debounceUpdate().

	*Params:
		fn: the function
		thisBinding: the this binding, if any
		delay: the minimum delay between to call
			for get: nothing is done is the delay is not met, simply return the last promise
			for update/fullSync, it waits for that delay before synchronizing again
		onDebounce: *ONLY* for GET ATM, a callback called when debounced
*/
Promise.debounceSync = ( getParams , fullSyncParams ) => {
	var perResourceData = new Map() ;

	const getResourceData = resourceId => {
		var resourceData = perResourceData.get( resourceId ) ;

		if ( ! resourceData ) {
			resourceData = {
				inProgress: null ,
				inProgressIsFull: null ,
				last: null ,				// Get or full sync promise
				lastTime: null ,			// Get or full sync time
				lastFullSync: null ,		// last full sync promise
				lastFullSyncTime: null ,	// last full sync time
				nextFullSyncPromise: null ,	// the promise for the next fullSync iteration
				nextFullSyncWith: null , 	// the 'this' and arguments for the next fullSync iteration
				noDelayBatches: new Set()		// only the first of the batch has no delay
			} ;

			perResourceData.set( resourceId , resourceData ) ;
		}

		return resourceData ;
	} ;


	const outWrapper = ( resourceData , level ) => {
		// level 2: fullSync, 1: get, 0: nothing but a delay
		var delta , args , sharedPromise , now = new Date() ;
		//lastTime = resourceData.lastTime , lastFullSyncTime = resourceData.lastFullSyncTime ;

		resourceData.inProgress = null ;

		if ( level >= 2 ) { resourceData.lastFullSyncTime = resourceData.lastTime = now ; }
		else if ( level >= 1 ) { resourceData.lastTime = now ; }

		if ( resourceData.nextFullSyncWith ) {
			if ( fullSyncParams.delay && resourceData.lastFullSyncTime && ( delta = now - resourceData.lastFullSyncTime - fullSyncParams.delay ) < 0 ) {
				resourceData.inProgress = Promise.resolveTimeout( - delta + 1 ) ;	// Strangely, sometime it is trigerred 1ms too soon
				resourceData.inProgress.finally( () => outWrapper( resourceData , 0 ) ) ;
				return resourceData.nextFullSyncPromise ;
			}

			args = resourceData.nextFullSyncWith ;
			resourceData.nextFullSyncWith = null ;
			sharedPromise = resourceData.nextFullSyncPromise ;
			resourceData.nextFullSyncPromise = null ;

			// Call the fullSyncParams.fn again
			resourceData.lastFullSync = resourceData.last = resourceData.inProgress = fullSyncParams.fn.call( ... args ) ;

			// Forward the result to the pending promise
			Promise.propagate( resourceData.inProgress , sharedPromise ) ;

			// BTW, trigger again the outWrapper
			Promise.finally( resourceData.inProgress , () => outWrapper( resourceData , 2 ) ) ;

			return resourceData.inProgress ;
		}
	} ;

	const getInWrapper = function( resourceId , ... args ) {
		var noDelay = false ,
			localThis = getParams.thisBinding || this ,
			resourceData = getResourceData( resourceId ) ;

		if ( args[ 0 ] === Promise.NO_DELAY ) {
			noDelay = true ;
			args.shift() ;
		}
		else if ( args[ 0 ] === Promise.BATCH_NO_DELAY ) {
			args.shift() ;
			let batchId = args.shift() ;
			if ( ! resourceData.noDelayBatches.has( batchId ) ) {
				resourceData.noDelayBatches.add( batchId ) ;
				noDelay = true ;
			}
		}

		if ( resourceData.inProgress ) { return resourceData.inProgress ; }

		if ( ! noDelay && getParams.delay && resourceData.lastTime && new Date() - resourceData.lastTime < getParams.delay ) {
			if ( typeof getParams.onDebounce === 'function' ) { getParams.onDebounce( resourceId , ... args ) ; }
			return resourceData.last ;
		}

		resourceData.last = resourceData.inProgress = getParams.fn.call( localThis , resourceId , ... args ) ;
		resourceData.inProgressIsFull = false ;
		Promise.finally( resourceData.inProgress , () => outWrapper( resourceData , 1 ) ) ;
		return resourceData.inProgress ;
	} ;

	const fullSyncInWrapper = function( resourceId , ... args ) {
		var delta ,
			noDelay = false ,
			localThis = fullSyncParams.thisBinding || this ,
			resourceData = getResourceData( resourceId ) ;

		if ( args[ 0 ] === Promise.NO_DELAY ) {
			noDelay = true ;
			args.shift() ;
		}
		else if ( args[ 0 ] === Promise.BATCH_NO_DELAY ) {
			args.shift() ;
			let batchId = args.shift() ;
			if ( ! resourceData.noDelayBatches.has( batchId ) ) {
				resourceData.noDelayBatches.add( batchId ) ;
				noDelay = true ;
			}
		}

		if ( ! resourceData.inProgress && ! noDelay && fullSyncParams.delay && resourceData.lastFullSyncTime && ( delta = new Date() - resourceData.lastFullSyncTime - fullSyncParams.delay ) < 0 ) {
			resourceData.inProgress = Promise.resolveTimeout( - delta + 1 ) ;	// Strangely, sometime it is trigerred 1ms too soon
			Promise.finally( resourceData.inProgress , () => outWrapper( resourceData , 0 ) ) ;
		}

		if ( resourceData.inProgress ) {
			// No difference between in-progress is 'get' or 'fullSync'
			if ( ! resourceData.nextFullSyncPromise ) { resourceData.nextFullSyncPromise = new Promise() ; }
			resourceData.nextFullSyncWith = [ localThis , resourceId , ... args ] ;
			return resourceData.nextFullSyncPromise ;
		}

		resourceData.lastFullSync = resourceData.last = resourceData.inProgress = fullSyncParams.fn.call( localThis , resourceId , ... args ) ;
		Promise.finally( resourceData.inProgress , () => outWrapper( resourceData , 2 ) ) ;
		return resourceData.inProgress ;
	} ;

	return [ getInWrapper , fullSyncInWrapper ] ;
} ;



// The call reject with a timeout error if it takes too much time
Promise.timeout = ( timeout , asyncFn , thisBinding ) => {
	return function( ... args ) {
		var promise = new Promise() ;
		Promise.propagate( asyncFn.call( thisBinding || this , ... args ) , promise ) ;
		setTimeout( () => promise.reject( new Error( 'Timeout' ) ) , timeout ) ;
		return promise ;
	} ;
} ;



// Like .timeout(), but here the timeout value is not passed at creation, but as the first arg of each call
Promise.variableTimeout = ( asyncFn , thisBinding ) => {
	return function( timeout , ... args ) {
		var promise = new Promise() ;
		Promise.propagate( asyncFn.call( thisBinding || this , ... args ) , promise ) ;
		setTimeout( () => promise.reject( new Error( 'Timeout' ) ) , timeout ) ;
		return promise ;
	} ;
} ;


},{"./seventh.js":15}],13:[function(require,module,exports){
(function (process){(function (){
/*
	Seventh

	Copyright (c) 2017 - 2020 Cédric Ronvel

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



const Promise = require( './seventh.js' ) ;



/*
	Asynchronously exit.

	Wait for all listeners of the 'asyncExit' event (on the 'process' object) to have called their callback.
	The listeners receive the exit code about to be produced and a completion callback.
*/

var exitInProgress = false ;

Promise.asyncExit = function( exitCode , timeout ) {
	// Already exiting? no need to call it twice!
	if ( exitInProgress ) { return ; }

	exitInProgress = true ;

	var listeners = process.listeners( 'asyncExit' ) ;

	if ( ! listeners.length ) { process.exit( exitCode ) ; return ; }

	if ( timeout === undefined ) { timeout = 1000 ; }

	const callListener = listener => {

		if ( listener.length < 3 ) {
			// This listener does not have a callback, it is interested in the event but does not need to perform critical stuff.
			// E.g. a server will not accept connection or data anymore, but doesn't need cleanup.
			listener( exitCode , timeout ) ;
			return Promise.dummy ;
		}

		// This listener have a callback, it probably has critical stuff to perform before exiting.
		// E.g. a server that needs to gracefully exit will not accept connection or data anymore,
		// but still want to deliver request in progress.
		return new Promise( resolve => {
			listener( exitCode , timeout , () => { resolve() ; } ) ;
		} ) ;

	} ;

	// We don't care about errors here... We are exiting!
	Promise.map( listeners , callListener )
		.finally( () => process.exit( exitCode ) ) ;

	// Quit anyway if it's too long
	setTimeout( () => process.exit( exitCode ) , timeout ) ;
} ;



// A timeout that ensure a task get the time to perform its action (when there are CPU-bound tasks)
Promise.resolveSafeTimeout = function( timeout , value ) {
	return new Promise( resolve => {
		setTimeout( () => {
			setTimeout( () => {
				setTimeout( () => {
					setTimeout( () => resolve( value ) , 0 ) ;
				} , timeout / 2 ) ;
			} , timeout / 2 ) ;
		} , 0 ) ;
	} ) ;
} ;


}).call(this)}).call(this,require('_process'))
},{"./seventh.js":15,"_process":74}],14:[function(require,module,exports){
/*
	Seventh

	Copyright (c) 2017 - 2020 Cédric Ronvel

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



const Promise = require( './seventh.js' ) ;



/*
	This parasite the native promise, bringing some of seventh features into them.
*/

Promise.parasite = () => {

	var compatibleProtoFn = [
		'tap' , 'tapCatch' , 'finally' ,
		'fatal' , 'done' ,
		'callback' , 'callbackAll'
	] ;

	compatibleProtoFn.forEach( fn => Promise.Native.prototype[ fn ] = Promise.prototype[ fn ] ) ;
	Promise.Native.prototype._then = Promise.Native.prototype.then ;
} ;


},{"./seventh.js":15}],15:[function(require,module,exports){
/*
	Seventh

	Copyright (c) 2017 - 2020 Cédric Ronvel

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



const seventh = require( './core.js' ) ;
module.exports = seventh ;

// The order matters
require( './batch.js' ) ;
require( './wrapper.js' ) ;
require( './decorators.js' ) ;
require( './Queue.js' ) ;
require( './api.js' ) ;
require( './parasite.js' ) ;
require( './misc.js' ) ;


},{"./Queue.js":8,"./api.js":9,"./batch.js":10,"./core.js":11,"./decorators.js":12,"./misc.js":13,"./parasite.js":14,"./wrapper.js":16}],16:[function(require,module,exports){
/*
	Seventh

	Copyright (c) 2017 - 2020 Cédric Ronvel

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



const Promise = require( './seventh.js' ) ;



Promise.timeLimit = ( timeout , asyncFnOrPromise ) => {
	return new Promise( ( resolve , reject ) => {
		if ( typeof asyncFnOrPromise === 'function' ) { asyncFnOrPromise = asyncFnOrPromise() ; }
		Promise.resolve( asyncFnOrPromise ).then( resolve , reject ) ;
		setTimeout( () => reject( new Error( "Timeout" ) ) , timeout ) ;
	} ) ;
} ;



/*
	options:
		retries: number of retry
		coolDown: time before retrying
		raiseFactor: time multiplier for each successive cool down
		maxCoolDown: maximum cool-down, the raising time is capped to this value
		timeout: time before assuming it has failed, 0 = no time limit
		catch: `function` (optional) if absent, the function is always retried until it reaches the limit,
			if present, that catch-function is used like a normal promise catch block, the function is retry
			only if the catch-function does not throw or return a rejecting promise
*/
Promise.retry = ( options , asyncFn ) => {
	var count = options.retries || 1 ,
		coolDown = options.coolDown || 0 ,
		raiseFactor = options.raiseFactor || 1 ,
		maxCoolDown = options.maxCoolDown || Infinity ,
		timeout = options.timeout || 0 ,
		catchFn = options.catch || null ;

	const oneTry = () => {
		return ( timeout ? Promise.timeLimit( timeout , asyncFn ) : asyncFn() ).catch( error => {
			if ( ! count -- ) { throw error ; }

			var currentCoolDown = coolDown ;
			coolDown = Math.min( coolDown * raiseFactor , maxCoolDown ) ;

			if ( catchFn ) {
				// Call the custom catch function
				// Let it crash, if it throw we are already in a .catch() block
				return Promise.resolve( catchFn( error ) ).then( () => Promise.resolveTimeout( currentCoolDown ).then( oneTry ) ) ;
			}

			return Promise.resolveTimeout( currentCoolDown ).then( oneTry ) ;
		} ) ;
	} ;

	return oneTry() ;
} ;



// Resolve once an event is fired
Promise.onceEvent = ( emitter , eventName ) => {
	return new Promise( resolve => emitter.once( eventName , resolve ) ) ;
} ;



// Resolve once an event is fired, resolve with an array of arguments
Promise.onceEventAll = ( emitter , eventName ) => {
	return new Promise( resolve => emitter.once( eventName , ( ... args ) => resolve( args ) ) ) ;
} ;



// Resolve once an event is fired, or reject on error
Promise.onceEventOrError = ( emitter , eventName , excludeEvents , _internalAllArgs = false ) => {
	return new Promise( ( resolve , reject ) => {
		var altRejects ;

		// We care about removing listener, especially 'error', because if an error kick in after, it should throw because there is no listener
		var resolve_ = ( ... args ) => {
			emitter.removeListener( 'error' , reject_ ) ;

			if ( altRejects ) {
				for ( let event in altRejects ) {
					emitter.removeListener( event , altRejects[ event ] ) ;
				}
			}

			resolve( _internalAllArgs ? args : args[ 0 ] ) ;
		} ;

		var reject_ = arg => {
			emitter.removeListener( eventName , resolve_ ) ;

			if ( altRejects ) {
				for ( let event in altRejects ) {
					emitter.removeListener( event , altRejects[ event ] ) ;
				}
			}

			reject( arg ) ;
		} ;

		emitter.once( eventName , resolve_ ) ;
		emitter.once( 'error' , reject_ ) ;

		if ( excludeEvents ) {
			if ( ! Array.isArray( excludeEvents ) ) { excludeEvents = [ excludeEvents ] ; }

			altRejects = {} ;

			excludeEvents.forEach( event => {
				var altReject = ( ... args ) => {
					emitter.removeListener( 'error' , reject_ ) ;
					emitter.removeListener( eventName , resolve_ ) ;

					var error = new Error( "Received an excluded event: " + event ) ;
					error.event = event ;
					error.eventArgs = args ;
					reject( error ) ;
				} ;

				emitter.once( event , altReject ) ;

				altRejects[ event ] = altReject ;
			} ) ;
		}
	} ) ;
} ;



// Resolve once an event is fired, or reject on error, resolve with an array of arguments, reject with the first argument
Promise.onceEventAllOrError = ( emitter , eventName , excludeEvents ) => {
	return Promise.onceEventOrError( emitter , eventName , excludeEvents , true ) ;
} ;


},{"./seventh.js":15}],17:[function(require,module,exports){
/*
	String Kit

	Copyright (c) 2014 - 2021 Cédric Ronvel

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



/*
	Number formatting class.
	.format() should entirely use it for everything related to number formatting.
	It avoids unsolvable rounding error with epsilon.
	It is dedicated for number display, not for computing.
*/



const NUMERALS = [
	'0' , '1' , '2' , '3' , '4' , '5' , '6' , '7' , '8' , '9' ,
	'a' , 'b' , 'c' , 'd' , 'e' , 'f' ,
	'g' , 'h' , 'i' , 'j' , 'k' , 'l' , 'm' , 'n' , 'o' , 'p' , 'q' , 'r' , 's' , 't' , 'u' , 'v' , 'w' , 'x' , 'y' , 'z'
] ;

//const NUMERAL_MAP = buildNumeralMap( NUMERALS ) ;



function StringNumber( number , options = {} ) {
	this.sign = 1 ;
	this.digits = [] ;
	this.exposant = 0 ;
	this.special = null ;	// It stores special values like NaN, Infinity, etc

	this.decimalSeparator = options.decimalSeparator ?? '.' ;
	this.forceDecimalSeparator = !! options.forceDecimalSeparator ;
	this.groupSeparator = options.groupSeparator ?? '' ;

	this.numerals = options.numerals ?? NUMERALS ;
	this.numeralZero = options.numeralZero ?? null ;	// Special numeral when the result is EXACTLY 0 (used for Roman Numerals)
	this.placeNumerals = options.placeNumerals ?? null ;
	//this.numeralMap = NUMERAL_MAP ;
	//if ( options.numerals ) { this.numeralMap = buildNumeralMap( options.numerals ) ; }

	this.set( number ) ;
}

module.exports = StringNumber ;



/*
function buildNumeralMap( numbers ) {
	var map = new Map() ;

	for ( let i = 0 ; i < numbers.length ; i ++ ) {
		let number = numbers[ i ] ;
		map.set( NUMERALS[ i ] , numbers[ i ] ) ;
	}

	return map ;
}
*/



StringNumber.prototype.set = function( number ) {
	var matches , v , i , iMax , index , hasNonZeroHead , tailIndex ;

	number = + number ;

	// Reset anything, if it was already used...
	this.sign = 1 ;
	this.digits.length = 0 ;
	this.exposant = 0 ;
	this.special = null ;

	if ( ! Number.isFinite( number ) ) {
		this.special = number ;
		return null ;
	}

	number = '' + number ;
	matches = number.match( /(-)?([0-9]+)(?:.([0-9]+))?(?:e([+-][0-9]+))?/ ) ;
	if ( ! matches ) { throw new Error( 'Unexpected error' ) ; }

	this.sign = matches[ 1 ] ? -1 : 1 ;
	this.exposant = matches[ 2 ].length + ( parseInt( matches[ 4 ] , 10 ) || 0 ) ;

	// Copy each digits and cast them back into a number
	index = 0 ;
	hasNonZeroHead = false ;
	tailIndex = 0 ;	// used to cut trailing zero

	for ( i = 0 , iMax = matches[ 2 ].length ; i < iMax ; i ++ ) {
		v = + matches[ 2 ][ i ] ;
		if ( v !== 0 ) {
			hasNonZeroHead = true ;
			this.digits[ index ] = v ;
			index ++ ;
			tailIndex = index ;
		}
		else if ( hasNonZeroHead ) {
			this.digits[ index ] = v ;
			index ++ ;
		}
		else {
			this.exposant -- ;
		}
	}

	if ( matches[ 3 ] ) {
		for ( i = 0 , iMax = matches[ 3 ].length ; i < iMax ; i ++ ) {
			v = + matches[ 3 ][ i ] ;

			if ( v !== 0 ) {
				hasNonZeroHead = true ;
				this.digits[ index ] = v ;
				index ++ ;
				tailIndex = index ;
			}
			else if ( hasNonZeroHead ) {
				this.digits[ index ] = v ;
				index ++ ;
			}
			else {
				this.exposant -- ;
			}
		}
	}

	if ( tailIndex !== index ) {
		this.digits.length = tailIndex ;
	}
} ;



StringNumber.prototype.toNumber = function() {
	// Using a string representation
	if ( this.special !== null ) { return this.special ; }
	return parseFloat( ( this.sign < 0 ? '-' : '' ) + '0.' + this.digits.join( '' ) + 'e' + this.exposant ) ;
} ;



StringNumber.prototype.toString = function( ... args ) {
	if ( this.special !== null ) { return '' + this.special ; }
	if ( this.exposant > 20 || this.exposant < -20 ) { return this.toScientificString( ... args ) ; }
	return this.toNoExpString( ... args ) ;
} ;



StringNumber.prototype.toExponential =
StringNumber.prototype.toExponentialString = function() {
	if ( this.special !== null ) { return '' + this.special ; }

	var str = this.sign < 0 ? '-' : '' ;
	if ( ! this.digits.length ) { return str + '0' ; }

	str += this.digits[ 0 ] ;

	if ( this.digits.length > 1 ) {
		str += this.decimalSeparator + this.digits.join( '' ).slice( 1 ) ;
	}

	str += 'e' + ( this.exposant > 0 ? '+' : '' ) + ( this.exposant - 1 ) ;
	return str ;
} ;



const SUPER_NUMBER = [ '⁰' , '¹' , '²' , '³' , '⁴' , '⁵' , '⁶' , '⁷' , '⁸' , '⁹' ] ;
const SUPER_PLUS = '⁺' ;
const SUPER_MINUS = '⁻' ;
const ZERO_CHAR_CODE = '0'.charCodeAt( 0 ) ;

StringNumber.prototype.toScientific =
StringNumber.prototype.toScientificString = function() {
	if ( this.special !== null ) { return '' + this.special ; }

	var str = this.sign < 0 ? '-' : '' ;
	if ( ! this.digits.length ) { return str + '0' ; }

	str += this.digits[ 0 ] ;

	if ( this.digits.length > 1 ) {
		str += this.decimalSeparator + this.digits.join( '' ).slice( 1 ) ;
	}

	var exposantStr =
		( this.exposant <= 0 ? SUPER_MINUS : '' ) +
		( '' + Math.abs( this.exposant - 1 ) ).split( '' ).map( c => SUPER_NUMBER[ c.charCodeAt( 0 ) - ZERO_CHAR_CODE ] )
			.join( '' ) ;

	str += ' × 10' + exposantStr ;
	return str ;
} ;



// leadingZero = minimal number of numbers before the dot, they will be left-padded with zero if needed.
// trailingZero = minimal number of numbers after the dot, they will be right-padded with zero if needed.
// onlyIfDecimal: set it to true if you don't want right padding zero when there is no decimal
StringNumber.prototype.toNoExp =
StringNumber.prototype.toNoExpString = function( leadingZero = 1 , trailingZero = 0 , onlyIfDecimal = false , forcePlusSign = false , exposant = this.exposant ) {
	if ( this.special !== null ) { return '' + this.special ; }

	var integerDigits = [] , decimalDigits = [] ,
		str = this.sign < 0 ? '-' : forcePlusSign ? '+' : '' ;

	if ( ! this.digits.length ) {
		if ( leadingZero > 1 ) {
			this.fillZeroes( integerDigits , leadingZero - 1 , leadingZero ) ;
		}

		integerDigits.push( this.numeralZero ?? this.placeNumerals?.[ 0 ]?.[ 0 ] ?? this.numerals[ 0 ] ) ;

		if ( trailingZero && ! onlyIfDecimal ) {
			this.fillZeroes( decimalDigits , trailingZero ) ;
		}
	}
	else if ( exposant <= 0 ) {
		// This number is of type 0.[0...]xyz
		this.fillZeroes( integerDigits , leadingZero ) ;

		this.fillZeroes( decimalDigits , -exposant , trailingZero - this.digits.length ) ;
		this.appendNumerals( decimalDigits , this.digits , undefined , undefined , -exposant - 1 ) ;

		if ( trailingZero && this.digits.length - exposant < trailingZero ) {
			this.fillZeroes( decimalDigits , trailingZero - this.digits.length + exposant ) ;
		}
	}
	else if ( exposant >= this.digits.length ) {
		// This number is of type xyz[0...]
		if ( exposant < leadingZero ) { this.fillZeroes( integerDigits , leadingZero - exposant , exposant - 1 ) ; }
		this.appendNumerals( integerDigits , this.digits , undefined , undefined , exposant - 1 ) ;
		this.fillZeroes( integerDigits , exposant - this.digits.length ) ;

		if ( trailingZero && ! onlyIfDecimal ) {
			this.fillZeroes( decimalDigits , trailingZero ) ;
		}
	}
	else {
		// Here the digits are splitted with a dot in the middle
		if ( exposant < leadingZero ) { this.fillZeroes( integerDigits , leadingZero - exposant ) ; }
		this.appendNumerals( integerDigits , this.digits , 0 , exposant , exposant - 1 ) ;

		this.appendNumerals( decimalDigits , this.digits , exposant , undefined , this.digits.length - exposant ) ;

		if (
			trailingZero && this.digits.length - exposant < trailingZero
			&& ( ! onlyIfDecimal || this.digits.length - exposant > 0 )
		) {
			this.fillZeroes( decimalDigits , trailingZero - this.digits.length + exposant ) ;
		}
	}

	str += this.groupSeparator ?
		this.groupDigits( integerDigits , this.groupSeparator ) :
		integerDigits.join( '' ) ;

	if ( decimalDigits.length ) {
		str += this.decimalSeparator + (
			this.decimalGroupSeparator ?
				this.groupDigits( decimalDigits , this.decimalGroupSeparator ) :
				decimalDigits.join( '' )
		) ;
	}
	else if ( this.forceDecimalSeparator ) {
		str += this.decimalSeparator ;
	}

	return str ;
} ;



// Metric prefix
const MUL_PREFIX = [ '' , 'k' , 'M' , 'G' , 'T' , 'P' , 'E' , 'Z' , 'Y' ] ;
const SUB_MUL_PREFIX = [ '' , 'm' , 'µ' , 'n' , 'p' , 'f' , 'a' , 'z' , 'y' ] ;



StringNumber.prototype.toMetric =
StringNumber.prototype.toMetricString = function( leadingZero = 1 , trailingZero = 0 , onlyIfDecimal = false , forcePlusSign = false ) {
	if ( this.special !== null ) { return '' + this.special ; }
	if ( ! this.digits.length ) { return this.sign > 0 ? '0' : '-0' ; }

	var prefix = '' , fakeExposant ;

	if ( this.exposant > 0 ) {
		fakeExposant = 1 + ( ( this.exposant - 1 ) % 3 ) ;
		prefix = MUL_PREFIX[ Math.floor( ( this.exposant - 1 ) / 3 ) ] ;
		// Fallback to scientific if the number is to big
		if ( prefix === undefined ) { return this.toScientificString() ; }
	}
	else {
		fakeExposant = 3 - ( -this.exposant % 3 ) ;
		prefix = SUB_MUL_PREFIX[ 1 + Math.floor( -this.exposant / 3 ) ] ;
		// Fallback to scientific if the number is to small
		if ( prefix === undefined ) { return this.toScientificString() ; }
	}

	return this.toNoExpString( leadingZero , trailingZero , onlyIfDecimal , forcePlusSign , fakeExposant ) + prefix ;
} ;



/*
	type: 0=round, -1=floor, 1=ceil
	Floor if < .99999
	Ceil if >= .00001
*/
StringNumber.prototype.precision = function( n , type = 0 ) {
	var roundUp ;

	if ( this.special !== null || n >= this.digits.length ) { return this ; }

	if ( n < 0 ) { this.digits.length = 0 ; return this ; }

	type *= this.sign ;

	if ( type < 0 ) {
		roundUp =
			this.digits.length > n + 4
			&& this.digits[ n ] === 9 && this.digits[ n + 1 ] === 9
			&& this.digits[ n + 2 ] === 9 && this.digits[ n + 3 ] === 9 && this.digits[ n + 4 ] === 9 ;
	}
	else if ( type > 0 ) {
		roundUp =
			this.digits[ n ] > 0 || this.digits[ n + 1 ] > 0
			|| this.digits[ n + 2 ] > 0 || this.digits[ n + 3 ] > 0 || this.digits[ n + 4 ] > 0 ;
	}
	else {
		roundUp = this.digits[ n ] >= 5 ;
	}

	if ( roundUp ) {
		let i = n - 1 ,
			done = false ;

		// Cascading increase
		for ( ; i >= 0 ; i -- ) {
			if ( this.digits[ i ] < 9 ) { this.digits[ i ] ++ ; done = true ; break ; }
			else { this.digits[ i ] = 0 ; }
		}

		if ( ! done ) {
			this.exposant ++ ;
			this.digits[ 0 ] = 1 ;
			this.digits.length = 1 ;
		}
		else {
			this.digits.length = i + 1 ;
		}
	}
	else {
		this.digits.length = n ;
		this.removeTrailingZero() ;
	}

	return this ;
} ;



StringNumber.prototype.round = function( decimalPlace = 0 , type = 0 ) {
	var n = this.exposant + decimalPlace ;
	return this.precision( n , type ) ;
} ;



StringNumber.prototype.floor = function( decimalPlace = 0 ) {
	var n = this.exposant + decimalPlace ;
	return this.precision( n , -1 ) ;
} ;



StringNumber.prototype.ceil = function( decimalPlace = 0 ) {
	var n = this.exposant + decimalPlace ;
	return this.precision( n , 1 ) ;
} ;



StringNumber.prototype.removeTrailingZero = function() {
	var i = this.digits.length - 1 ;
	while( i >= 0 && this.digits[ i ] === 0 ) { i -- ; }
	this.digits.length = i + 1 ;
} ;



const GROUP_SIZE = 3 ;

StringNumber.prototype.groupDigits = function( digits , separator , inverseOrder = false ) {
	var str = '' ,
		offset = inverseOrder ? 0 : GROUP_SIZE - ( digits.length % GROUP_SIZE ) ,
		i = 0 ,
		iMax = digits.length ;

	for ( ; i < iMax ; i ++ ) {
		str += i && ( ( i + offset ) % GROUP_SIZE === 0 ) ? separator + digits[ i ] : digits[ i ] ;
	}

	return str ;
} ;



StringNumber.prototype.appendNumerals = function( intoArray , sourceArray , start = 0 , end = sourceArray.length , leftPlace = end ) {
	//console.log( "appendNumerals:" , { intoArray , sourceArray , start , end , leftPlace } ) ;
	for ( let i = start , place = leftPlace ; i < end ; i ++ , place -- ) {
		let numerals = this.placeNumerals?.[ place ] ?? this.numerals ;
		intoArray.push( numerals[ sourceArray[ i ] ] ?? sourceArray[ i ] ) ;
	}

	return intoArray ;
} ;



StringNumber.prototype.fillZeroes = function( intoArray , count , leftPlace = count - 1 ) {
	//console.log( "fillZeroes:" , { intoArray , count , leftPlace } ) ;
	for ( let i = 0 , place = leftPlace ; i < count ; i ++ , place -- ) {
		let numerals = this.placeNumerals?.[ place ] ?? this.numerals ;
		intoArray.push( numerals[ 0 ] ?? 0 ) ;
	}

	return intoArray ;
} ;



const ROMAN_OPTIONS = {
	numeralZero: 'N' ,
	placeNumerals: [
		[ '' , 'I' , 'II' , 'III' , 'IV' , 'V' , 'VI' , 'VII' , 'VIII' , 'IX' ] ,
		[ '' , 'X' , 'XX' , 'XXX' , 'XL' , 'L' , 'LX' , 'LXX' , 'LXXX' , 'XC' ] ,
		[ '' , 'C' , 'CC' , 'CCC' , 'CD' , 'D' , 'DC' , 'DCC' , 'DCCC' , 'CM' ] ,
		[ '' , 'M' , 'MM' , 'MMM' , 'MMMM' , 'ↁ' , 'ↁↀ' , 'ↁↀↀ' , 'ↁↀↀↀ' , 'ↁↀↀↀↀ' ]
	]
} ;

const ADDITIVE_ROMAN_OPTIONS = {
	numeralZero: 'N' ,
	placeNumerals: [
		[ '' , 'I' , 'II' , 'III' , 'IIII' , 'V' , 'VI' , 'VII' , 'VIII' , 'VIIII' ] ,
		[ '' , 'X' , 'XX' , 'XXX' , 'XXXX' , 'L' , 'LX' , 'LXX' , 'LXXX' , 'LXXXX' ] ,
		[ '' , 'C' , 'CC' , 'CCC' , 'CCCC' , 'D' , 'DC' , 'DCC' , 'DCCC' , 'DCCCC' ] ,
		[ '' , 'M' , 'MM' , 'MMM' , 'MMMM' , 'ↁ' , 'ↁↀ' , 'ↁↀↀ' , 'ↁↀↀↀ' , 'ↁↀↀↀↀ' ]
	]
} ;

const APOSTROPHUS_ROMAN_OPTIONS = {
	numeralZero: 'N' ,
	placeNumerals: [
		[ '' , 'I' , 'II' , 'III' , 'IV' , 'V' , 'VI' , 'VII' , 'VIII' , 'IX' ] ,
		[ '' , 'X' , 'XX' , 'XXX' , 'XL' , 'L' , 'LX' , 'LXX' , 'LXXX' , 'XC' ] ,
		[ '' , 'C' , 'CC' , 'CCC' , 'CD' , 'D' , 'DC' , 'DCC' , 'DCCC' , 'CM' ] ,
		[ '' , 'M' , 'MM' , 'MMM' , 'MMMM' , 'IↃↃ' , 'IↃↃCIↃ' , 'IↃↃCIↃCIↃ' , 'IↃↃCIↃCIↃCIↃ' , 'IↃↃCIↃCIↃCIↃCIↃ' ] ,
		[ '' , 'CCIↃↃ' , 'CCIↃↃCCIↃↃ' , 'CCIↃↃCCIↃↃCCIↃↃ' , 'CCIↃↃCCIↃↃCCIↃↃCCIↃↃ' , 'IↃↃↃ' , 'IↃↃↃCCIↃↃ' , 'IↃↃↃCCIↃↃCCIↃↃ' , 'IↃↃↃCCIↃↃCCIↃↃCCIↃↃ' , 'IↃↃↃCCIↃↃCCIↃↃCCIↃↃCCIↃↃ' ] ,
		[ '' , 'CCCIↃↃↃ' , 'CCCIↃↃↃCCCIↃↃↃ' , 'CCCIↃↃↃCCCIↃↃↃCCCIↃↃↃ' , 'CCCIↃↃↃCCCIↃↃↃCCCIↃↃↃCCCIↃↃↃ' , 'IↃↃↃↃ' , 'IↃↃↃↃCCCIↃↃↃ' , 'IↃↃↃↃCCCIↃↃↃCCCIↃↃↃ' , 'IↃↃↃↃCCCIↃↃↃCCCIↃↃↃCCCIↃↃↃ' , 'IↃↃↃↃCCCIↃↃↃCCCIↃↃↃCCCIↃↃↃCCCIↃↃↃ' ]
	]
} ;

StringNumber.roman = ( number , options ) => {
	options = options ? Object.assign( {} , options , ROMAN_OPTIONS ) : ROMAN_OPTIONS ;
	return new StringNumber( number , options ) ;
} ;

StringNumber.additiveRoman = ( number , options ) => {
	options = options ? Object.assign( {} , options , ADDITIVE_ROMAN_OPTIONS ) : ADDITIVE_ROMAN_OPTIONS ;
	return new StringNumber( number , options ) ;
} ;


},{}],18:[function(require,module,exports){
/*
	String Kit

	Copyright (c) 2014 - 2021 Cédric Ronvel

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



// To solve dependency hell, we do not rely on terminal-kit anymore.
const ansi = {
	reset: '\x1b[0m' ,
	bold: '\x1b[1m' ,
	dim: '\x1b[2m' ,
	italic: '\x1b[3m' ,
	underline: '\x1b[4m' ,
	inverse: '\x1b[7m' ,

	defaultColor: '\x1b[39m' ,
	black: '\x1b[30m' ,
	red: '\x1b[31m' ,
	green: '\x1b[32m' ,
	yellow: '\x1b[33m' ,
	blue: '\x1b[34m' ,
	magenta: '\x1b[35m' ,
	cyan: '\x1b[36m' ,
	white: '\x1b[37m' ,
	grey: '\x1b[90m' ,
	gray: '\x1b[90m' ,
	brightBlack: '\x1b[90m' ,
	brightRed: '\x1b[91m' ,
	brightGreen: '\x1b[92m' ,
	brightYellow: '\x1b[93m' ,
	brightBlue: '\x1b[94m' ,
	brightMagenta: '\x1b[95m' ,
	brightCyan: '\x1b[96m' ,
	brightWhite: '\x1b[97m' ,

	defaultBgColor: '\x1b[49m' ,
	bgBlack: '\x1b[40m' ,
	bgRed: '\x1b[41m' ,
	bgGreen: '\x1b[42m' ,
	bgYellow: '\x1b[43m' ,
	bgBlue: '\x1b[44m' ,
	bgMagenta: '\x1b[45m' ,
	bgCyan: '\x1b[46m' ,
	bgWhite: '\x1b[47m' ,
	bgGrey: '\x1b[100m' ,
	bgGray: '\x1b[100m' ,
	bgBrightBlack: '\x1b[100m' ,
	bgBrightRed: '\x1b[101m' ,
	bgBrightGreen: '\x1b[102m' ,
	bgBrightYellow: '\x1b[103m' ,
	bgBrightBlue: '\x1b[104m' ,
	bgBrightMagenta: '\x1b[105m' ,
	bgBrightCyan: '\x1b[106m' ,
	bgBrightWhite: '\x1b[107m'
} ;

module.exports = ansi ;



ansi.fgColor = {
	defaultColor: ansi.defaultColor ,
	black: ansi.black ,
	red: ansi.red ,
	green: ansi.green ,
	yellow: ansi.yellow ,
	blue: ansi.blue ,
	magenta: ansi.magenta ,
	cyan: ansi.cyan ,
	white: ansi.white ,
	grey: ansi.grey ,
	gray: ansi.gray ,
	brightBlack: ansi.brightBlack ,
	brightRed: ansi.brightRed ,
	brightGreen: ansi.brightGreen ,
	brightYellow: ansi.brightYellow ,
	brightBlue: ansi.brightBlue ,
	brightMagenta: ansi.brightMagenta ,
	brightCyan: ansi.brightCyan ,
	brightWhite: ansi.brightWhite
} ;



ansi.bgColor = {
	defaultColor: ansi.defaultBgColor ,
	black: ansi.bgBlack ,
	red: ansi.bgRed ,
	green: ansi.bgGreen ,
	yellow: ansi.bgYellow ,
	blue: ansi.bgBlue ,
	magenta: ansi.bgMagenta ,
	cyan: ansi.bgCyan ,
	white: ansi.bgWhite ,
	grey: ansi.bgGrey ,
	gray: ansi.bgGray ,
	brightBlack: ansi.bgBrightBlack ,
	brightRed: ansi.bgBrightRed ,
	brightGreen: ansi.bgBrightGreen ,
	brightYellow: ansi.bgBrightYellow ,
	brightBlue: ansi.bgBrightBlue ,
	brightMagenta: ansi.bgBrightMagenta ,
	brightCyan: ansi.bgBrightCyan ,
	brightWhite: ansi.bgBrightWhite
} ;



ansi.trueColor = ( r , g , b ) => {
	if ( g === undefined && typeof r === 'string' ) {
		let hex = r ;
		if ( hex[ 0 ] === '#' ) { hex = hex.slice( 1 ) ; }	// Strip the # if necessary
		if ( hex.length === 3 ) { hex = hex[ 0 ] + hex[ 0 ] + hex[ 1 ] + hex[ 1 ] + hex[ 2 ] + hex[ 2 ] ; }
		r = parseInt( hex.slice( 0 , 2 ) , 16 ) || 0 ;
		g = parseInt( hex.slice( 2 , 4 ) , 16 ) || 0 ;
		b = parseInt( hex.slice( 4 , 6 ) , 16 ) || 0 ;
	}

	return '\x1b[38;2;' + r + ';' + g + ';' + b + 'm' ;
} ;



ansi.bgTrueColor = ( r , g , b ) => {
	if ( g === undefined && typeof r === 'string' ) {
		let hex = r ;
		if ( hex[ 0 ] === '#' ) { hex = hex.slice( 1 ) ; }	// Strip the # if necessary
		if ( hex.length === 3 ) { hex = hex[ 0 ] + hex[ 0 ] + hex[ 1 ] + hex[ 1 ] + hex[ 2 ] + hex[ 2 ] ; }
		r = parseInt( hex.slice( 0 , 2 ) , 16 ) || 0 ;
		g = parseInt( hex.slice( 2 , 4 ) , 16 ) || 0 ;
		b = parseInt( hex.slice( 4 , 6 ) , 16 ) || 0 ;
	}

	return '\x1b[48;2;' + r + ';' + g + ';' + b + 'm' ;
} ;



const ANSI_CODES = {
	'0': null ,

	'1': { bold: true } ,
	'2': { dim: true } ,
	'22': { bold: false , dim: false } ,
	'3': { italic: true } ,
	'23': { italic: false } ,
	'4': { underline: true } ,
	'24': { underline: false } ,
	'5': { blink: true } ,
	'25': { blink: false } ,
	'7': { inverse: true } ,
	'27': { inverse: false } ,
	'8': { hidden: true } ,
	'28': { hidden: false } ,
	'9': { strike: true } ,
	'29': { strike: false } ,

	'30': { color: 0 } ,
	'31': { color: 1 } ,
	'32': { color: 2 } ,
	'33': { color: 3 } ,
	'34': { color: 4 } ,
	'35': { color: 5 } ,
	'36': { color: 6 } ,
	'37': { color: 7 } ,
	//'39': { defaultColor: true } ,
	'39': { color: 'default' } ,

	'90': { color: 8 } ,
	'91': { color: 9 } ,
	'92': { color: 10 } ,
	'93': { color: 11 } ,
	'94': { color: 12 } ,
	'95': { color: 13 } ,
	'96': { color: 14 } ,
	'97': { color: 15 } ,

	'40': { bgColor: 0 } ,
	'41': { bgColor: 1 } ,
	'42': { bgColor: 2 } ,
	'43': { bgColor: 3 } ,
	'44': { bgColor: 4 } ,
	'45': { bgColor: 5 } ,
	'46': { bgColor: 6 } ,
	'47': { bgColor: 7 } ,
	//'49': { bgDefaultColor: true } ,
	'49': { bgColor: 'default' } ,

	'100': { bgColor: 8 } ,
	'101': { bgColor: 9 } ,
	'102': { bgColor: 10 } ,
	'103': { bgColor: 11 } ,
	'104': { bgColor: 12 } ,
	'105': { bgColor: 13 } ,
	'106': { bgColor: 14 } ,
	'107': { bgColor: 15 }
} ;



// Parse ANSI codes, output is compatible with the markup parser
ansi.parse = str => {
	var ansiCodes , raw , part , style , output = [] ;

	for ( [ , ansiCodes , raw ] of str.matchAll( /\x1b\[([0-9;]+)m|(.[^\x1b]*)/g ) ) {
		if ( raw ) {
			if ( output.length ) { output[ output.length - 1 ].text += raw ; }
			else { output.push( { text: raw } ) ; }
		}
		else {
			ansiCodes.split( ';' ).forEach( ansiCode => {
				style = ANSI_CODES[ ansiCode ] ;
				if ( style === undefined ) { return ; }

				if ( ! output.length || output[ output.length - 1 ].text ) {
					if ( ! style ) {
						part = { text: '' } ;
					}
					else {
						part = Object.assign( {} , part , style ) ;
						part.text = '' ;
					}

					output.push( part ) ;
				}
				else {
					// There is no text, no need to create a new part
					if ( ! style ) {
						// Replace the last part
						output[ output.length - 1 ] = { text: '' } ;
					}
					else {
						// update the last part
						Object.assign( part , style ) ;
					}
				}
			} ) ;
		}
	}

	return output ;
} ;


},{}],19:[function(require,module,exports){
/*
	String Kit

	Copyright (c) 2014 - 2021 Cédric Ronvel

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



var camel = {} ;
module.exports = camel ;



// Transform alphanum separated by underscore or minus to camel case
camel.toCamelCase = function( str , preserveUpperCase = false , initialUpperCase = false ) {
	if ( ! str || typeof str !== 'string' ) { return '' ; }

	return str.replace(
		/(?:^[\s_-]*|([\s_-]+))(([^\s_-]?)([^\s_-]*))/g ,
		( match , isNotFirstWord , word , firstLetter , endOfWord ) => {
			if ( preserveUpperCase ) {
				if ( ! isNotFirstWord && ! initialUpperCase ) { return word ; }
				if ( ! firstLetter ) { return '' ; }
				return firstLetter.toUpperCase() + endOfWord ;
			}

			if ( ! isNotFirstWord && ! initialUpperCase ) { return word.toLowerCase() ; }
			if ( ! firstLetter ) { return '' ; }
			return firstLetter.toUpperCase() + endOfWord.toLowerCase() ;
		}
	) ;
} ;



camel.camelCaseToSeparated = function( str , separator = ' ' , acronym = true ) {
	if ( ! str || typeof str !== 'string' ) { return '' ; }

	if ( ! acronym ) {
		return str.replace( /^([A-Z])|([A-Z])/g , ( match , firstLetter , letter ) => {
			if ( firstLetter ) { return firstLetter.toLowerCase() ; }
			return separator + letter.toLowerCase() ;
		} ) ;
	}

	// (^)? and (^)? does not work, so we have to use (?:(^)|)) and (?:($)|)) to capture end or not
	return str.replace( /(?:(^)|)([A-Z]+)(?:($)|(?=[a-z]))/g , ( match , isStart , letters , isEnd ) => {
		isStart = isStart === '' ;
		isEnd = isEnd === '' ;

		var prefix = isStart ? '' : separator ;

		return letters.length === 1 ? prefix + letters.toLowerCase() :
			isEnd ? prefix + letters :
			letters.length === 2 ? prefix + letters[ 0 ].toLowerCase() + separator + letters[ 1 ].toLowerCase() :
			prefix + letters.slice( 0 , -1 ) + separator + letters.slice( -1 ).toLowerCase() ;
	} ) ;
} ;



// Transform camel case to alphanum separated by minus
camel.camelCaseToDash =
camel.camelCaseToDashed = ( str ) => camel.camelCaseToSeparated( str , '-' , false ) ;


},{}],20:[function(require,module,exports){
/*
	Book Source

	Copyright (c) 2023 Cédric Ronvel

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



const latinize = require( './latinize.js' ) ;
const english = require( './english.js' ) ;

const KEYWORD_TO_CHARLIST = require( './json-data/emoji-keyword-to-charlist.json' ) ;
const CHAR_TO_CANONICAL_NAME = require( './json-data/emoji-char-to-canonical-name.json' ) ;



const emoji = {} ;
module.exports = emoji ;



emoji.getCanonicalName = emojiChar => CHAR_TO_CANONICAL_NAME[ emojiChar ] ;



const emojiToKeywordsCache = {} ;

// Return a cached and frozen array
emoji.getKeywords = emojiChar => {
	if ( ! CHAR_TO_CANONICAL_NAME[ emojiChar ] ) { return ; }

	if ( ! emojiToKeywordsCache[ emojiChar ] ) {
		emojiToKeywordsCache[ emojiChar ] = emoji.splitIntoKeywords( CHAR_TO_CANONICAL_NAME[ emojiChar ] ) ;
		Object.freeze( emojiToKeywordsCache[ emojiChar ] ) ;
	}

	return emojiToKeywordsCache[ emojiChar ] ;
} ;



emoji.search = ( name , bestOnly = false ) => {
	var keywords = emoji.splitIntoKeywords( name ) ,
		matches = {} ,
		score ,
		bestScore = 0 ;

	for ( let keyword of keywords ) {
		if ( ! KEYWORD_TO_CHARLIST[ keyword ] ) { continue ; }

		for ( let emojiChar of KEYWORD_TO_CHARLIST[ keyword ] ) {
			if ( ! matches[ emojiChar ] ) {
				score = 1 ;
				matches[ emojiChar ] = {
					emoji: emojiChar ,
					score ,
					canonical: CHAR_TO_CANONICAL_NAME[ emojiChar ] ,
					keywords: emoji.getKeywords( emojiChar )
				} ;
			}
			else {
				score = matches[ emojiChar ].score + 1 ;
				matches[ emojiChar ].score = score ;
			}

			if ( score > bestScore ) { bestScore = score ; }
		}
	}

	var results = [ ... Object.values( matches ) ] ;
	if ( bestOnly ) { results = results.filter( e => e.score === bestScore ) ; }
	results.sort( ( a , b ) => ( b.score - a.score ) || ( a.keywords.length - b.keywords.length ) ) ;
	return results ;
} ;

emoji.searchBest = name => emoji.search( name , true ) ;
emoji.get = name => emoji.search( name , true )[ 0 ]?.emoji ;





// Internal API, exposed because it is used by the builder



emoji.simplifyName = name => {
	name = name.toLowerCase().replace( /[“”().!]/g , '' ).replace( /[ ’',]/g , '-' ).replace( /-+/g , '-' ) ;
	name = latinize( name ) ;
	return name ;
} ;



emoji.simplifyKeyword = inputKeyword => {
	var kw = inputKeyword ;
	kw = english.undoPresentParticiple( kw ) ;

	//if ( kw !== inputKeyword ) { console.log( "Changing KW:" , inputKeyword , "-->" , kw ) ; }
	return kw ;
} ;



const KEYWORD_EXCLUSION = new Set( [ 'with' , 'of' ] ) ;

emoji.splitIntoKeywords = ( name , noSimplify = false ) => {
	if ( ! noSimplify ) { name = emoji.simplifyName( name ) ; }
	var keywords = name.split( /-/g ).filter( keyword => keyword.length >= 2 && ! KEYWORD_EXCLUSION.has( keyword ) ) ;
	keywords = keywords.map( emoji.simplifyKeyword ) ;
	keywords = [ ... new Set( keywords ) ] ;	// Make them unique
	return keywords ;
} ;


},{"./english.js":21,"./json-data/emoji-char-to-canonical-name.json":26,"./json-data/emoji-keyword-to-charlist.json":27,"./latinize.js":30}],21:[function(require,module,exports){
/*
	Book Source

	Copyright (c) 2023 Cédric Ronvel

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



const english = {} ;
module.exports = english ;



const VOWELS = new Set( [ 'a' , 'e' , 'i' , 'o' , 'u' , 'y' ] ) ;
const VOWELS_ADDING_E = new Set( [ 'a' , 'i' , 'o' , 'u' ] ) ;
const CONSONANTS_AFTER_VOWEL_ADDING_E = new Set( [ 's' ] ) ;
const CONSONANTS_ADDING_E = new Set( [ 'v' ] ) ;
const CONSONANTS_NOT_ADDING_E = new Set( [ 'w' , 'x' ] ) ;
const DOUBLE_CONSONANTS_ADDING_E = new Set( [ 'cl' , 'dl' , 'gl' , 'kl' , 'nc' , 'pl' , 'tl' ] ) ;
const REDUCING_DOUBLE_CONSONANTS = new Set( [ 'd' , 'g' , 'm' , 'n' , 'p' ] ) ;
const CONSONANTS_AFTER_VOWELS_COMBO_NOT_ADDING_E = new Set( [ 'or' ] ) ;	// Last chance fix

// Remove -ing and transform to a proper verb or noun
english.undoPresentParticiple = word => {
	if ( word.endsWith( 'ing' ) && word.length >= 6 && ! word.endsWith( 'ghtning' ) ) {
		let ingSuffix = 'ing' ;
		//if ( word.endsWith( 'ling' ) ) { ingSuffix = 'ling' ; }

		let ingLen = ingSuffix.length ;

		let before = word[ word.length - ingLen - 1 ] ,
			before2 = word[ word.length - ingLen - 2 ] ,
			before3 = word[ word.length - ingLen - 3 ] ;

		if ( VOWELS.has( before ) ) {
			word = word.slice( 0 , -ingLen ) ;
		}
		else if ( VOWELS.has( before2 ) ) {
			if ( VOWELS.has( before3 ) ) {
				if ( CONSONANTS_AFTER_VOWEL_ADDING_E.has( before ) && ! CONSONANTS_AFTER_VOWELS_COMBO_NOT_ADDING_E.has( before2 + before ) ) {
					word = word.slice( 0 , -ingLen ) + 'e' ;
				}
				else {
					word = word.slice( 0 , -ingLen ) ;
				}
			}
			else if ( VOWELS_ADDING_E.has( before2 ) && ! CONSONANTS_NOT_ADDING_E.has( before ) ) {
				word = word.slice( 0 , -ingLen ) + 'e' ;
			}
			else {
				word = word.slice( 0 , -ingLen ) ;
			}
		}
		else if ( before === before2 && REDUCING_DOUBLE_CONSONANTS.has( before ) ) {
			word = word.slice( 0 , -ingLen - 1 ) ;
		}
		else if ( CONSONANTS_ADDING_E.has( before ) || DOUBLE_CONSONANTS_ADDING_E.has( before2 + before ) ) {
			word = word.slice( 0 , -ingLen ) + 'e' ;
		}
		else {
			word = word.slice( 0 , -ingLen ) ;
		}
	}

	return word ;
} ;


},{}],22:[function(require,module,exports){
/*
	String Kit

	Copyright (c) 2014 - 2021 Cédric Ronvel

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

/*
	Escape collection.
*/



"use strict" ;



// From Mozilla Developper Network
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
exports.regExp = exports.regExpPattern = str => str.replace( /([.*+?^${}()|[\]/\\])/g , '\\$1' ) ;

// This replace any single $ by a double $$
exports.regExpReplacement = str => str.replace( /\$/g , '$$$$' ) ;

// Escape for string.format()
// This replace any single % by a double %%
exports.format = str => str.replace( /%/g , '%%' ) ;

exports.jsSingleQuote = str => exports.control( str ).replace( /'/g , "\\'" ) ;
exports.jsDoubleQuote = str => exports.control( str ).replace( /"/g , '\\"' ) ;

exports.shellArg = str => '\'' + str.replace( /'/g , "'\\''" ) + '\'' ;



var escapeControlMap = {
	'\r': '\\r' ,
	'\n': '\\n' ,
	'\t': '\\t' ,
	'\x7f': '\\x7f'
} ;

// Escape \r \n \t so they become readable again, escape all ASCII control character as well, using \x syntaxe
exports.control = ( str , keepNewLineAndTab = false ) => str.replace( /[\x00-\x1f\x7f]/g , match => {
	if ( keepNewLineAndTab && ( match === '\n' || match === '\t' ) ) { return match ; }
	if ( escapeControlMap[ match ] !== undefined ) { return escapeControlMap[ match ] ; }
	var hex = match.charCodeAt( 0 ).toString( 16 ) ;
	if ( hex.length % 2 ) { hex = '0' + hex ; }
	return '\\x' + hex ;
} ) ;



var escapeHtmlMap = {
	'&': '&amp;' ,
	'<': '&lt;' ,
	'>': '&gt;' ,
	'"': '&quot;' ,
	"'": '&#039;'
} ;

// Only escape & < > so this is suited for content outside tags
exports.html = str => str.replace( /[&<>]/g , match => escapeHtmlMap[ match ] ) ;

// Escape & < > " so this is suited for content inside a double-quoted attribute
exports.htmlAttr = str => str.replace( /[&<>"]/g , match => escapeHtmlMap[ match ] ) ;

// Escape all html special characters & < > " '
exports.htmlSpecialChars = str => str.replace( /[&<>"']/g , match => escapeHtmlMap[ match ] ) ;

// Percent-encode all control chars and codepoint greater than 255 using percent encoding
exports.unicodePercentEncode = str => str.replace( /[\x00-\x1f\u0100-\uffff\x7f%]/g , match => {
	try {
		return encodeURI( match ) ;
	}
	catch ( error ) {
		// encodeURI can throw on bad surrogate pairs, but we just strip those characters
		return '' ;
	}
} ) ;

// Encode HTTP header value
exports.httpHeaderValue = str => exports.unicodePercentEncode( str ) ;


},{}],23:[function(require,module,exports){
(function (Buffer){(function (){
/*
	String Kit

	Copyright (c) 2014 - 2021 Cédric Ronvel

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

/*
	String formater, inspired by C's sprintf().
*/



"use strict" ;



const inspect = require( './inspect.js' ).inspect ;
const inspectError = require( './inspect.js' ).inspectError ;
const escape = require( './escape.js' ) ;
const ansi = require( './ansi.js' ) ;
const unicode = require( './unicode.js' ) ;
const naturalSort = require( './naturalSort.js' ) ;
const StringNumber = require( './StringNumber.js' ) ;



/*
	%%		a single %
	%s		string
	%S		string, interpret ^ formatting
	%r		raw string: without sanitizer
	%n		natural: output the most natural representation for this type, object entries are sorted by keys
	%N		even more natural: avoid type hinting marks like bracket for array
	%f		float
	%k		number with metric system prefixes
	%e		for exponential notation (e.g. 1.23e+2)
	%K		for scientific notation (e.g. 1.23 × 10²)
	%i	%d	integer
	%u		unsigned integer
	%U		unsigned positive integer (>0)
	%P		number to (absolute) percent (e.g.: 0.75 -> 75%)
	%p		number to relative percent (e.g.: 1.25 -> +25% ; 0.75 -> -25%)
	%T		date/time display, using ISO date, or Intl module
	%t		time duration, convert ms into h min s, e.g.: 2h14min52s or 2:14:52
	%m		convert degree into degree, minutes and seconds
	%h		hexadecimal (input is a number)
	%x		hexadecimal (input is a number), force pair of symbols (e.g. 'f' -> '0f')
	%o		octal
	%b		binary
	%X		hexadecimal: convert a string into hex charcode, force pair of symbols (e.g. 'f' -> '0f')
	%z		base64
	%Z		base64url
	%I		call string-kit's inspect()
	%Y		call string-kit's inspect(), but do not inspect non-enumerable
	%O		object (like inspect, but with ultra minimal options)
	%E		call string-kit's inspectError()
	%J		JSON.stringify()
	%v		roman numerals, additive variant (e.g. 4 is IIII instead of IV)
	%V		roman numerals
	%D		drop
	%F		filter function existing in the 'this' context, e.g. %[filter:%a%a]F
	%a		argument for a function

	Candidate format:
	%A		for automatic type? probably not good: it's like %n Natural
	%c		for char? (can receive a string or an integer translated into an UTF8 chars)
	%C		for currency formating?
	%B		for Buffer objects?
*/

exports.formatMethod = function( ... args ) {
	var arg ,
		str = args[ 0 ] ,
		autoIndex = 1 ,
		length = args.length ;

	if ( typeof str !== 'string' ) {
		if ( ! str ) { str = '' ; }
		else if ( typeof str.toString === 'function' ) { str = str.toString() ; }
		else { str = '' ; }
	}

	var runtime = {
		hasMarkup: false ,
		shift: null ,
		markupStack: []
	} ;

	if ( this.markupReset && this.startingMarkupReset ) {
		str = ( typeof this.markupReset === 'function' ? this.markupReset( runtime.markupStack ) : this.markupReset ) + str ;
	}

	//console.log( 'format args:' , arguments ) ;

	// /!\ each changes here should be reported on string.format.count() and string.format.hasFormatting() too /!\
	// Note: the closing bracket is optional to prevent ReDoS
	str = str.replace( /\^\[([^\]]*)]?|\^(.)|(%%)|%([+-]?)([0-9]*)(?:\[([^\]]*)\])?([a-zA-Z])/g ,
		( match , complexMarkup , markup , doublePercent , relative , index , modeArg , mode ) => {
			var replacement , i , tmp , fn , fnArgString , argMatches , argList = [] ;

			//console.log( 'replaceArgs:' , arguments ) ;
			if ( doublePercent ) { return '%' ; }

			if ( complexMarkup ) { markup = complexMarkup ; }
			if ( markup ) {
				if ( this.noMarkup ) { return '^' + markup ; }
				return markupReplace.call( this , runtime , match , markup ) ;
			}

			if ( index ) {
				index = parseInt( index , 10 ) ;

				if ( relative ) {
					if ( relative === '+' ) { index = autoIndex + index ; }
					else if ( relative === '-' ) { index = autoIndex - index ; }
				}
			}
			else {
				index = autoIndex ;
			}

			autoIndex ++ ;

			if ( index >= length || index < 1 ) { arg = undefined ; }
			else { arg = args[ index ] ; }

			if ( modes[ mode ] ) {
				replacement = modes[ mode ]( arg , modeArg , this ) ;
				if ( this.argumentSanitizer && ! modes[ mode ].noSanitize ) { replacement = this.argumentSanitizer( replacement ) ; }
				if ( this.escapeMarkup && ! modes[ mode ].noEscapeMarkup ) { replacement = exports.escapeMarkup( replacement ) ; }
				if ( modeArg && ! modes[ mode ].noCommonModeArg ) { replacement = commonModeArg( replacement , modeArg ) ; }
				return replacement ;
			}

			// Function mode
			if ( mode === 'F' ) {
				autoIndex -- ;	// %F does not eat any arg

				if ( modeArg === undefined ) { return '' ; }
				tmp = modeArg.split( ':' ) ;
				fn = tmp[ 0 ] ;
				fnArgString = tmp[ 1 ] ;
				if ( ! fn ) { return '' ; }

				if ( fnArgString && ( argMatches = fnArgString.match( /%([+-]?)([0-9]*)[a-zA-Z]/g ) ) ) {
					//console.log( argMatches ) ;
					//console.log( fnArgString ) ;
					for ( i = 0 ; i < argMatches.length ; i ++ ) {
						relative = argMatches[ i ][ 1 ] ;
						index = argMatches[ i ][ 2 ] ;

						if ( index ) {
							index = parseInt( index , 10 ) ;

							if ( relative ) {
								if ( relative === '+' ) { index = autoIndex + index ; }		// jshint ignore:line
								else if ( relative === '-' ) { index = autoIndex - index ; }	// jshint ignore:line
							}
						}
						else {
							index = autoIndex ;
						}

						autoIndex ++ ;

						if ( index >= length || index < 1 ) { argList[ i ] = undefined ; }
						else { argList[ i ] = args[ index ] ; }
					}
				}

				if ( ! this || ! this.fn || typeof this.fn[ fn ] !== 'function' ) { return '' ; }
				return this.fn[ fn ].apply( this , argList ) ;
			}

			return '' ;
		}
	) ;

	if ( runtime.hasMarkup && this.markupReset && this.endingMarkupReset ) {
		str += typeof this.markupReset === 'function' ? this.markupReset( runtime.markupStack ) : this.markupReset ;
	}

	if ( this.extraArguments ) {
		for ( ; autoIndex < length ; autoIndex ++ ) {
			arg = args[ autoIndex ] ;
			if ( arg === null || arg === undefined ) { continue ; }
			else if ( typeof arg === 'string' ) { str += arg ; }
			else if ( typeof arg === 'number' ) { str += arg ; }
			else if ( typeof arg.toString === 'function' ) { str += arg.toString() ; }
		}
	}

	return str ;
} ;



exports.markupMethod = function( str ) {
	if ( typeof str !== 'string' ) {
		if ( ! str ) { str = '' ; }
		else if ( typeof str.toString === 'function' ) { str = str.toString() ; }
		else { str = '' ; }
	}

	var runtime = {
		hasMarkup: false ,
		shift: null ,
		markupStack: []
	} ;

	if ( this.parse ) {
		let markupObjects , markupObject , match , complexMarkup , markup , raw , lastChunk ,
			output = [] ;

		// Note: the closing bracket is optional to prevent ReDoS
		for ( [ match , complexMarkup , markup , raw ] of str.matchAll( /\^\[([^\]]*)]?|\^(.)|([^^]+)/g ) ) {
			if ( raw ) {
				if ( output.length ) { output[ output.length - 1 ].text += raw ; }
				else { output.push( { text: raw } ) ; }
				continue ;
			}

			if ( complexMarkup ) { markup = complexMarkup ; }
			markupObjects = markupReplace.call( this , runtime , match , markup ) ;

			if ( ! Array.isArray( markupObjects ) ) { markupObjects = [ markupObjects ] ; }

			for ( markupObject of markupObjects ) {
				lastChunk = output.length ? output[ output.length - 1 ] : null ;
				if ( typeof markupObject === 'string' ) {
					// This markup is actually a text to add to the last chunk (e.g. "^^" markup is converted to a single "^")
					if ( lastChunk ) { lastChunk.text += markupObject ; }
					else { output.push( { text: markupObject } ) ; }
				}
				else if ( ! markupObject ) {
					// Null is for a markup's style reset
					if ( lastChunk && lastChunk.text.length && Object.keys( lastChunk ).length > 1 ) {
						// If there was style and text on the last chunk, then this means that the new markup starts a new chunk
						// markupObject can be null for markup reset function, but we have to create a new chunk
						output.push( { text: '' } ) ;
					}
				}
				else {
					if ( lastChunk && lastChunk.text.length ) {
						// If there was text on the last chunk, then this means that the new markup starts a new chunk
						output.push( Object.assign( { text: '' } , ... runtime.markupStack ) ) ;
					}
					else {
						// There wasn't any text added, so append the current markup style to the current chunk
						if ( lastChunk ) { Object.assign( lastChunk , markupObject ) ; }
						else { output.push( Object.assign( { text: '' } , markupObject ) ) ; }
					}
				}
			}
		}

		return output ;
	}

	if ( this.markupReset && this.startingMarkupReset ) {
		str = ( typeof this.markupReset === 'function' ? this.markupReset( runtime.markupStack ) : this.markupReset ) + str ;
	}

	str = str.replace( /\^\[([^\]]*)]?|\^(.)/g , ( match , complexMarkup , markup ) => markupReplace.call( this , runtime , match , complexMarkup || markup ) ) ;

	if ( runtime.hasMarkup && this.markupReset && this.endingMarkupReset ) {
		str += typeof this.markupReset === 'function' ? this.markupReset( runtime.markupStack ) : this.markupReset ;
	}

	return str ;
} ;



// Used by both formatMethod and markupMethod
function markupReplace( runtime , match , markup ) {
	var markupTarget , key , value , replacement , colonIndex ;

	if ( markup === '^' ) { return '^' ; }

	if ( this.shiftMarkup && this.shiftMarkup[ markup ] ) {
		runtime.shift = this.shiftMarkup[ markup ] ;
		return '' ;
	}

	if ( markup.length > 1 && this.dataMarkup && ( colonIndex = markup.indexOf( ':' ) ) !== -1 ) {
		key = markup.slice( 0 , colonIndex ) ;
		markupTarget = this.dataMarkup[ key ] ;

		if ( markupTarget === undefined ) {
			if ( this.markupCatchAll === undefined ) { return '' ; }
			markupTarget = this.markupCatchAll ;
		}

		runtime.hasMarkup = true ;
		value = markup.slice( colonIndex + 1 ) ;

		if ( typeof markupTarget === 'function' ) {
			replacement = markupTarget( runtime.markupStack , key , value ) ;
			// method should manage markup stack themselves
		}
		else {
			replacement = { [ markupTarget ]: value } ;
			stackMarkup( runtime , replacement ) ;
		}

		return replacement ;
	}

	if ( runtime.shift ) {
		markupTarget = this.shiftedMarkup?.[ runtime.shift ]?.[ markup ] ;
		runtime.shift = null ;
	}
	else {
		markupTarget = this.markup?.[ markup ] ;
	}

	if ( markupTarget === undefined ) {
		if ( this.markupCatchAll === undefined ) { return '' ; }
		markupTarget = this.markupCatchAll ;
	}

	runtime.hasMarkup = true ;

	if ( typeof markupTarget === 'function' ) {
		replacement = markupTarget( runtime.markupStack , markup ) ;
		// method should manage markup stack themselves
	}
	else {
		replacement = markupTarget ;
		stackMarkup( runtime , replacement ) ;
	}

	return replacement ;
}



// internal method for markupReplace()
function stackMarkup( runtime , replacement ) {
	if ( Array.isArray( replacement ) ) {
		for ( let item of replacement ) {
			if ( item === null ) { runtime.markupStack.length = 0 ; }
			else { runtime.markupStack.push( item ) ; }
		}
	}
	else {
		if ( replacement === null ) { runtime.markupStack.length = 0 ; }
		else { runtime.markupStack.push( replacement ) ; }
	}
}



// Note: the closing bracket is optional to prevent ReDoS
exports.stripMarkup = str => str.replace( /\^\[[^\]]*]?|\^./g , match =>
	match === '^^' ? '^' :
	match === '^ ' ? ' ' :
	''
) ;

exports.escapeMarkup = str => str.replace( /\^/g , '^^' ) ;



const DEFAULT_FORMATTER = {
	argumentSanitizer: str => escape.control( str , true ) ,
	extraArguments: true ,
	color: false ,
	noMarkup: false ,
	escapeMarkup: false ,
	endingMarkupReset: true ,
	startingMarkupReset: false ,
	markupReset: ansi.reset ,
	shiftMarkup: {
		'#': 'background'
	} ,
	markup: {
		":": ansi.reset ,
		" ": ansi.reset + " " ,

		"-": ansi.dim ,
		"+": ansi.bold ,
		"_": ansi.underline ,
		"/": ansi.italic ,
		"!": ansi.inverse ,

		"b": ansi.blue ,
		"B": ansi.brightBlue ,
		"c": ansi.cyan ,
		"C": ansi.brightCyan ,
		"g": ansi.green ,
		"G": ansi.brightGreen ,
		"k": ansi.black ,
		"K": ansi.brightBlack ,
		"m": ansi.magenta ,
		"M": ansi.brightMagenta ,
		"r": ansi.red ,
		"R": ansi.brightRed ,
		"w": ansi.white ,
		"W": ansi.brightWhite ,
		"y": ansi.yellow ,
		"Y": ansi.brightYellow
	} ,
	shiftedMarkup: {
		background: {
			":": ansi.reset ,
			" ": ansi.reset + " " ,

			"b": ansi.bgBlue ,
			"B": ansi.bgBrightBlue ,
			"c": ansi.bgCyan ,
			"C": ansi.bgBrightCyan ,
			"g": ansi.bgGreen ,
			"G": ansi.bgBrightGreen ,
			"k": ansi.bgBlack ,
			"K": ansi.bgBrightBlack ,
			"m": ansi.bgMagenta ,
			"M": ansi.bgBrightMagenta ,
			"r": ansi.bgRed ,
			"R": ansi.bgBrightRed ,
			"w": ansi.bgWhite ,
			"W": ansi.bgBrightWhite ,
			"y": ansi.bgYellow ,
			"Y": ansi.bgBrightYellow
		}
	} ,
	dataMarkup: {
		fg: ( markupStack , key , value ) => {
			var str = ansi.fgColor[ value ] || ansi.trueColor( value ) ;
			markupStack.push( str ) ;
			return str ;
		} ,
		bg: ( markupStack , key , value ) => {
			var str = ansi.bgColor[ value ] || ansi.bgTrueColor( value ) ;
			markupStack.push( str ) ;
			return str ;
		}
	} ,
	markupCatchAll: ( markupStack , key , value ) => {
		var str = '' ;

		if ( value === undefined ) {
			if ( key[ 0 ] === '#' ) {
				str = ansi.trueColor( key ) ;
			}
			else if ( typeof ansi[ key ] === 'string' ) {
				str = ansi[ key ] ;
			}
		}

		markupStack.push( str ) ;
		return str ;
	}
} ;

// Aliases
DEFAULT_FORMATTER.dataMarkup.color = DEFAULT_FORMATTER.dataMarkup.c = DEFAULT_FORMATTER.dataMarkup.fgColor = DEFAULT_FORMATTER.dataMarkup.fg ;
DEFAULT_FORMATTER.dataMarkup.bgColor = DEFAULT_FORMATTER.dataMarkup.bg ;



exports.createFormatter = ( options ) => exports.formatMethod.bind( Object.assign( {} , DEFAULT_FORMATTER , options ) ) ;
exports.format = exports.formatMethod.bind( DEFAULT_FORMATTER ) ;
exports.format.default = DEFAULT_FORMATTER ;

exports.formatNoMarkup = exports.formatMethod.bind( Object.assign( {} , DEFAULT_FORMATTER , { noMarkup: true } ) ) ;
// For passing string to Terminal-Kit, it will interpret markup on its own
exports.formatThirdPartyMarkup = exports.formatMethod.bind( Object.assign( {} , DEFAULT_FORMATTER , { noMarkup: true , escapeMarkup: true } ) ) ;

exports.createMarkup = ( options ) => exports.markupMethod.bind( Object.assign( {} , DEFAULT_FORMATTER , options ) ) ;
exports.markup = exports.markupMethod.bind( DEFAULT_FORMATTER ) ;



// Count the number of parameters needed for this string
exports.format.count = function( str , noMarkup = false ) {
	var markup , index , relative , autoIndex = 1 , maxIndex = 0 ;

	if ( typeof str !== 'string' ) { return 0 ; }

	// This regex differs slightly from the main regex: we do not count '%%' and %F is excluded
	// Note: the closing bracket is optional to prevent ReDoS
	var regexp = noMarkup ?
		/%([+-]?)([0-9]*)(?:\[[^\]]*\])?[a-zA-EG-Z]/g :
		/%([+-]?)([0-9]*)(?:\[[^\]]*\])?[a-zA-EG-Z]|(\^\[[^\]]*]?|\^.)/g ;

	for ( [ , relative , index , markup ] of str.matchAll( regexp ) ) {
		if ( markup ) { continue ; }

		if ( index ) {
			index = parseInt( index , 10 ) ;

			if ( relative ) {
				if ( relative === '+' ) { index = autoIndex + index ; }
				else if ( relative === '-' ) { index = autoIndex - index ; }
			}
		}
		else {
			index = autoIndex ;
		}

		autoIndex ++ ;

		if ( maxIndex < index ) { maxIndex = index ; }
	}

	return maxIndex ;
} ;



// Tell if this string contains formatter chars
exports.format.hasFormatting = function( str ) {
	if ( str.search( /\^(.?)|(%%)|%([+-]?)([0-9]*)(?:\[([^\]]*)\])?([a-zA-Z])/ ) !== -1 ) { return true ; }
	return false ;
} ;



// --- Format MODES ---

const modes = {} ;
exports.format.modes = modes ;	// <-- expose modes, used by Babel-Tower for String Kit interop'



// string
modes.s = ( arg , modeArg ) => {
	var subModes = stringModeArg( modeArg ) ;

	if ( typeof arg === 'string' ) { return arg ; }
	if ( arg === null || arg === undefined || arg === false ) { return subModes.empty ? '' : '(' + arg + ')' ; }
	if ( arg === true ) { return '(' + arg + ')' ; }
	if ( typeof arg === 'number' ) { return '' + arg ; }
	if ( typeof arg.toString === 'function' ) { return arg.toString() ; }
	return '(' + arg + ')' ;
} ;

modes.r = arg => modes.s( arg ) ;
modes.r.noSanitize = true ;



// string, interpret ^ formatting
modes.S = ( arg , modeArg , options ) => {
	var subModes = stringModeArg( modeArg ) ;

	// We do the sanitizing part on our own
	var interpret = options.escapeMarkup ? str => ( options.argumentSanitizer ? options.argumentSanitizer( str ) : str ) :
		str => exports.markupMethod.call( options , options.argumentSanitizer ? options.argumentSanitizer( str ) : str ) ;

	if ( typeof arg === 'string' ) { return interpret( arg ) ; }
	if ( arg === null || arg === undefined || arg === false ) { return subModes.empty ? '' : '(' + arg + ')' ; }
	if ( arg === true ) { return '(' + arg + ')' ; }
	if ( typeof arg === 'number' ) { return '' + arg ; }
	if ( typeof arg.toString === 'function' ) { return interpret( arg.toString() ) ; }
	return interpret( '(' + arg + ')' ) ;
} ;

modes.S.noSanitize = true ;
modes.S.noEscapeMarkup = true ;
modes.S.noCommonModeArg = true ;



// natural (WIP)
modes.N = ( arg , modeArg ) => genericNaturalMode( arg , modeArg , false ) ;
modes.n = ( arg , modeArg ) => genericNaturalMode( arg , modeArg , true ) ;



// float
modes.f = ( arg , modeArg ) => {
	if ( typeof arg === 'string' ) { arg = parseFloat( arg ) ; }
	if ( typeof arg !== 'number' ) { arg = 0 ; }

	var subModes = floatModeArg( modeArg ) ,
		sn = new StringNumber( arg , { decimalSeparator: '.' , groupSeparator: subModes.groupSeparator } ) ;

	if ( subModes.rounding !== null ) { sn.round( subModes.rounding ) ; }
	if ( subModes.precision ) { sn.precision( subModes.precision ) ; }

	return sn.toString( subModes.leftPadding , subModes.rightPadding , subModes.rightPaddingOnlyIfDecimal ) ;
} ;

modes.f.noSanitize = true ;



// roman numeral, additive variant
modes.v = ( arg , modeArg ) => {
	if ( typeof arg === 'string' ) { arg = parseFloat( arg ) ; }
	if ( typeof arg !== 'number' ) { arg = 0 ; }

	var subModes = floatModeArg( modeArg ) ,
		sn = StringNumber.additiveRoman( arg , { decimalSeparator: '.' , groupSeparator: subModes.groupSeparator } ) ;

	if ( subModes.rounding !== null ) { sn.round( subModes.rounding ) ; }
	if ( subModes.precision ) { sn.precision( subModes.precision ) ; }

	return sn.toString( subModes.leftPadding , subModes.rightPadding , subModes.rightPaddingOnlyIfDecimal ) ;
} ;

modes.v.noSanitize = true ;



// roman numeral
modes.V = ( arg , modeArg ) => {
	if ( typeof arg === 'string' ) { arg = parseFloat( arg ) ; }
	if ( typeof arg !== 'number' ) { arg = 0 ; }

	var subModes = floatModeArg( modeArg ) ,
		sn = StringNumber.roman( arg , { decimalSeparator: '.' , groupSeparator: subModes.groupSeparator } ) ;

	if ( subModes.rounding !== null ) { sn.round( subModes.rounding ) ; }
	if ( subModes.precision ) { sn.precision( subModes.precision ) ; }

	return sn.toString( subModes.leftPadding , subModes.rightPadding , subModes.rightPaddingOnlyIfDecimal ) ;
} ;

modes.V.noSanitize = true ;



// absolute percent
modes.P = ( arg , modeArg ) => {
	if ( typeof arg === 'string' ) { arg = parseFloat( arg ) ; }
	if ( typeof arg !== 'number' ) { arg = 0 ; }

	arg *= 100 ;

	var subModes = floatModeArg( modeArg ) ,
		sn = new StringNumber( arg , { decimalSeparator: '.' , groupSeparator: subModes.groupSeparator } ) ;

	// Force rounding to zero by default
	if ( subModes.rounding !== null || ! subModes.precision ) { sn.round( subModes.rounding || 0 ) ; }
	if ( subModes.precision ) { sn.precision( subModes.precision ) ; }

	return sn.toNoExpString( subModes.leftPadding , subModes.rightPadding , subModes.rightPaddingOnlyIfDecimal ) + '%' ;
} ;

modes.P.noSanitize = true ;



// relative percent
modes.p = ( arg , modeArg ) => {
	if ( typeof arg === 'string' ) { arg = parseFloat( arg ) ; }
	if ( typeof arg !== 'number' ) { arg = 0 ; }

	arg = ( arg - 1 ) * 100 ;

	var subModes = floatModeArg( modeArg ) ,
		sn = new StringNumber( arg , { decimalSeparator: '.' , groupSeparator: subModes.groupSeparator } ) ;

	// Force rounding to zero by default
	if ( subModes.rounding !== null || ! subModes.precision ) { sn.round( subModes.rounding || 0 ) ; }
	if ( subModes.precision ) { sn.precision( subModes.precision ) ; }

	// 4th argument force a '+' sign
	return sn.toNoExpString( subModes.leftPadding , subModes.rightPadding , subModes.rightPaddingOnlyIfDecimal , true ) + '%' ;
} ;

modes.p.noSanitize = true ;



// metric system
modes.k = ( arg , modeArg ) => {
	if ( typeof arg === 'string' ) { arg = parseFloat( arg ) ; }
	if ( typeof arg !== 'number' ) { return '0' ; }

	var subModes = floatModeArg( modeArg ) ,
		sn = new StringNumber( arg , { decimalSeparator: '.' , groupSeparator: subModes.groupSeparator } ) ;

	if ( subModes.rounding !== null ) { sn.round( subModes.rounding ) ; }
	// Default to 3 numbers precision
	if ( subModes.precision || subModes.rounding === null ) { sn.precision( subModes.precision || 3 ) ; }

	return sn.toMetricString( subModes.leftPadding , subModes.rightPadding , subModes.rightPaddingOnlyIfDecimal ) ;
} ;

modes.k.noSanitize = true ;



// exponential notation, a.k.a. "E notation" (e.g. 1.23e+2)
modes.e = ( arg , modeArg ) => {
	if ( typeof arg === 'string' ) { arg = parseFloat( arg ) ; }
	if ( typeof arg !== 'number' ) { arg = 0 ; }

	var subModes = floatModeArg( modeArg ) ,
		sn = new StringNumber( arg , { decimalSeparator: '.' , groupSeparator: subModes.groupSeparator } ) ;

	if ( subModes.rounding !== null ) { sn.round( subModes.rounding ) ; }
	if ( subModes.precision ) { sn.precision( subModes.precision ) ; }

	return sn.toExponential() ;
} ;

modes.e.noSanitize = true ;



// scientific notation (e.g. 1.23 × 10²)
modes.K = ( arg , modeArg ) => {
	if ( typeof arg === 'string' ) { arg = parseFloat( arg ) ; }
	if ( typeof arg !== 'number' ) { arg = 0 ; }

	var subModes = floatModeArg( modeArg ) ,
		sn = new StringNumber( arg , { decimalSeparator: '.' , groupSeparator: subModes.groupSeparator } ) ;

	if ( subModes.rounding !== null ) { sn.round( subModes.rounding ) ; }
	if ( subModes.precision ) { sn.precision( subModes.precision ) ; }

	return sn.toScientific() ;
} ;

modes.K.noSanitize = true ;



// integer
modes.d = modes.i = arg => {
	if ( typeof arg === 'string' ) { arg = parseFloat( arg ) ; }
	if ( typeof arg === 'number' ) { return '' + Math.floor( arg ) ; }
	return '0' ;
} ;

modes.i.noSanitize = true ;



// unsigned integer
modes.u = arg => {
	if ( typeof arg === 'string' ) { arg = parseFloat( arg ) ; }
	if ( typeof arg === 'number' ) { return '' + Math.max( Math.floor( arg ) , 0 ) ; }
	return '0' ;
} ;

modes.u.noSanitize = true ;



// unsigned positive integer
modes.U = arg => {
	if ( typeof arg === 'string' ) { arg = parseFloat( arg ) ; }
	if ( typeof arg === 'number' ) { return '' + Math.max( Math.floor( arg ) , 1 ) ; }
	return '1' ;
} ;

modes.U.noSanitize = true ;



// /!\ Should use StringNumber???
// Degree, minutes and seconds.
// Unlike %t which receive ms, here the input is in degree.
modes.m = arg => {
	if ( typeof arg === 'string' ) { arg = parseFloat( arg ) ; }
	if ( typeof arg !== 'number' ) { return '(NaN)' ; }

	var minus = '' ;
	if ( arg < 0 ) { minus = '-' ; arg = -arg ; }

	var degrees = epsilonFloor( arg ) ,
		frac = arg - degrees ;

	if ( ! frac ) { return minus + degrees + '°' ; }

	var minutes = epsilonFloor( frac * 60 ) ,
		seconds = epsilonFloor( frac * 3600 - minutes * 60 ) ;

	if ( seconds ) {
		return minus + degrees + '°' + ( '' + minutes ).padStart( 2 , '0' ) + '′' + ( '' + seconds ).padStart( 2 , '0' ) + '″' ;
	}

	return minus + degrees + '°' + ( '' + minutes ).padStart( 2 , '0' ) + '′' ;

} ;

modes.m.noSanitize = true ;



// Date/time
// Minimal Date formating, only support sort of ISO ATM.
// It will be improved later.
modes.T = ( arg , modeArg ) => {
	// Always get a copy of the arg
	try {
		arg = new Date( arg ) ;
	}
	catch ( error ) {
		return '(invalid)' ;
	}

	if ( Number.isNaN( arg.getTime() ) ) {
		return '(invalid)' ;
	}

	var datePart = '' ,
		timePart = '' ,
		str = '' ,
		subModes = dateTimeModeArg( modeArg ) ,
		roundingType = subModes.roundingType ,
		forceDecimalSeparator = subModes.useAbbreviation ;

	// For instance, we only support the ISO-like type

	if ( subModes.years ) {
		if ( datePart ) { datePart += '-' ; }
		datePart += arg.getFullYear() ;
	}

	if ( subModes.months ) {
		if ( datePart ) { datePart += '-' ; }
		datePart += ( '' + ( arg.getMonth() + 1 ) ).padStart( 2 , '0' ) ;
	}

	if ( subModes.days ) {
		if ( datePart ) { datePart += '-' ; }
		datePart += ( '' + arg.getDate() ).padStart( 2 , '0' ) ;
	}

	if ( subModes.hours ) {
		if ( timePart && ! subModes.useAbbreviation ) { timePart += ':' ; }
		timePart += ( '' + arg.getHours() ).padStart( 2 , '0' ) ;
		if ( subModes.useAbbreviation ) { timePart += 'h' ; }
	}

	if ( subModes.minutes ) {
		if ( timePart && ! subModes.useAbbreviation ) { timePart += ':' ; }
		timePart += ( '' + arg.getMinutes() ).padStart( 2 , '0' ) ;
		if ( subModes.useAbbreviation ) { timePart += 'min' ; }
	}

	if ( subModes.seconds ) {
		if ( timePart && ! subModes.useAbbreviation ) { timePart += ':' ; }
		timePart += ( '' + arg.getSeconds() ).padStart( 2 , '0' ) ;
		if ( subModes.useAbbreviation ) { timePart += 's' ; }
	}

	if ( datePart ) {
		if ( str ) { str += ' ' ; }
		str += datePart ;
	}

	if ( timePart ) {
		if ( str ) { str += ' ' ; }
		str += timePart ;
	}

	return str ;
} ;

modes.T.noSanitize = true ;



// Time duration, transform ms into H:min:s
modes.t = ( arg , modeArg ) => {
	if ( typeof arg === 'string' ) { arg = parseFloat( arg ) ; }
	if ( typeof arg !== 'number' ) { return '(NaN)' ; }

	var h , min , s , sn , sStr ,
		sign = '' ,
		subModes = timeDurationModeArg( modeArg ) ,
		roundingType = subModes.roundingType ,
		hSeparator = subModes.useAbbreviation ? 'h' : ':' ,
		minSeparator = subModes.useAbbreviation ? 'min' : ':' ,
		sSeparator = subModes.useAbbreviation ? 's' : '.' ,
		forceDecimalSeparator = subModes.useAbbreviation ;

	s = arg / 1000 ;

	if ( s < 0 ) {
		s = -s ;
		roundingType *= -1 ;
		sign = '-' ;
	}

	if ( s < 60 && ! subModes.forceMinutes ) {
		sn = new StringNumber( s , { decimalSeparator: sSeparator , forceDecimalSeparator } ) ;
		sn.round( subModes.rounding , roundingType ) ;

		// Check if rounding has made it reach 60
		if ( sn.toNumber() < 60 ) {
			sStr = sn.toString( 1 , subModes.rightPadding , subModes.rightPaddingOnlyIfDecimal ) ;
			return sign + sStr ;
		}

		s = 60 ;

	}

	min = Math.floor( s / 60 ) ;
	s = s % 60 ;

	sn = new StringNumber( s , { decimalSeparator: sSeparator , forceDecimalSeparator } ) ;
	sn.round( subModes.rounding , roundingType ) ;

	// Check if rounding has made it reach 60
	if ( sn.toNumber() < 60 ) {
		sStr = sn.toString( 2 , subModes.rightPadding , subModes.rightPaddingOnlyIfDecimal ) ;
	}
	else {
		min ++ ;
		s = 0 ;
		sn.set( s ) ;
		sStr = sn.toString( 2 , subModes.rightPadding , subModes.rightPaddingOnlyIfDecimal ) ;
	}

	if ( min < 60 && ! subModes.forceHours ) {
		return sign + min + minSeparator + sStr ;
	}

	h = Math.floor( min / 60 ) ;
	min = min % 60 ;

	return sign + h + hSeparator + ( '' + min ).padStart( 2 , '0' ) + minSeparator + sStr ;
} ;

modes.t.noSanitize = true ;



// unsigned hexadecimal
modes.h = arg => {
	if ( typeof arg === 'string' ) { arg = parseFloat( arg ) ; }
	if ( typeof arg === 'number' ) { return '' + Math.max( Math.floor( arg ) , 0 ).toString( 16 ) ; }
	return '0' ;
} ;

modes.h.noSanitize = true ;



// unsigned hexadecimal, force pair of symboles
modes.x = arg => {
	if ( typeof arg === 'string' ) { arg = parseFloat( arg ) ; }
	if ( typeof arg !== 'number' ) { return '00' ; }

	var value = '' + Math.max( Math.floor( arg ) , 0 ).toString( 16 ) ;

	if ( value.length % 2 ) { value = '0' + value ; }
	return value ;
} ;

modes.x.noSanitize = true ;



// unsigned octal
modes.o = arg => {
	if ( typeof arg === 'string' ) { arg = parseFloat( arg ) ; }
	if ( typeof arg === 'number' ) { return '' + Math.max( Math.floor( arg ) , 0 ).toString( 8 ) ; }
	return '0' ;
} ;

modes.o.noSanitize = true ;



// unsigned binary
modes.b = arg => {
	if ( typeof arg === 'string' ) { arg = parseFloat( arg ) ; }
	if ( typeof arg === 'number' ) { return '' + Math.max( Math.floor( arg ) , 0 ).toString( 2 ) ; }
	return '0' ;
} ;

modes.b.noSanitize = true ;



// String to hexadecimal, force pair of symboles
modes.X = arg => {
	if ( typeof arg === 'string' ) { arg = Buffer.from( arg ) ; }
	else if ( ! Buffer.isBuffer( arg ) ) { return '' ; }
	return arg.toString( 'hex' ) ;
} ;

modes.X.noSanitize = true ;



// base64
modes.z = arg => {
	if ( typeof arg === 'string' ) { arg = Buffer.from( arg ) ; }
	else if ( ! Buffer.isBuffer( arg ) ) { return '' ; }
	return arg.toString( 'base64' ) ;
} ;



// base64url
modes.Z = arg => {
	if ( typeof arg === 'string' ) { arg = Buffer.from( arg ) ; }
	else if ( ! Buffer.isBuffer( arg ) ) { return '' ; }
	return arg.toString( 'base64' ).replace( /\+/g , '-' )
		.replace( /\//g , '_' )
		.replace( /[=]{1,2}$/g , '' ) ;
} ;



// Inspect
const I_OPTIONS = {} ;
modes.I = ( arg , modeArg , options ) => genericInspectMode( arg , modeArg , options , I_OPTIONS ) ;
modes.I.noSanitize = true ;



// More minimalist inspect
const Y_OPTIONS = {
	noFunc: true ,
	enumOnly: true ,
	noDescriptor: true ,
	useInspect: true ,
	useInspectPropertyBlackList: true
} ;
modes.Y = ( arg , modeArg , options ) => genericInspectMode( arg , modeArg , options , Y_OPTIONS ) ;
modes.Y.noSanitize = true ;



// Even more minimalist inspect
const O_OPTIONS = { minimal: true , bulletIndex: true , noMarkup: true } ;
modes.O = ( arg , modeArg , options ) => genericInspectMode( arg , modeArg , options , O_OPTIONS ) ;
modes.O.noSanitize = true ;



// Inspect error
const E_OPTIONS = {} ;
modes.E = ( arg , modeArg , options ) => genericInspectMode( arg , modeArg , options , E_OPTIONS , true ) ;
modes.E.noSanitize = true ;



// JSON
modes.J = arg => arg === undefined ? 'null' : JSON.stringify( arg ) ;



// drop
modes.D = () => '' ;
modes.D.noSanitize = true ;



// ModeArg formats

// The format for commonModeArg
const COMMON_MODE_ARG_FORMAT_REGEX = /([a-zA-Z])(.[^a-zA-Z]*)/g ;

// The format for specific mode arg
const MODE_ARG_FORMAT_REGEX = /([a-zA-Z]|^)([^a-zA-Z]*)/g ;



// Called when there is a modeArg and the mode allow common mode arg
// CONVENTION: reserve upper-cased letters for common mode arg
function commonModeArg( str , modeArg ) {
	for ( let [ , k , v ] of modeArg.matchAll( COMMON_MODE_ARG_FORMAT_REGEX ) ) {
		if ( k === 'L' ) {
			let width = unicode.width( str ) ;
			v = + v || 1 ;

			if ( width > v ) {
				str = unicode.truncateWidth( str , v - 1 ).trim() + '…' ;
				width = unicode.width( str ) ;
			}

			if ( width < v ) { str = ' '.repeat( v - width ) + str ; }
		}
		else if ( k === 'R' ) {
			let width = unicode.width( str ) ;
			v = + v || 1 ;

			if ( width > v ) {
				str = unicode.truncateWidth( str , v - 1 ).trim() + '…' ;
				width = unicode.width( str ) ;
			}

			if ( width < v ) { str = str + ' '.repeat( v - width ) ; }
		}
	}

	return str ;
}



const FLOAT_MODES = {
	leftPadding: 1 ,
	rightPadding: 0 ,
	rightPaddingOnlyIfDecimal: false ,
	rounding: null ,
	precision: null ,
	groupSeparator: ''
} ;

// Generic number modes
function floatModeArg( modeArg ) {
	FLOAT_MODES.leftPadding = 1 ;
	FLOAT_MODES.rightPadding = 0 ;
	FLOAT_MODES.rightPaddingOnlyIfDecimal = false ;
	FLOAT_MODES.rounding = null ;
	FLOAT_MODES.precision = null ;
	FLOAT_MODES.groupSeparator = '' ;

	if ( modeArg ) {
		for ( let [ , k , v ] of modeArg.matchAll( MODE_ARG_FORMAT_REGEX ) ) {
			if ( k === 'z' ) {
				// Zero-left padding
				FLOAT_MODES.leftPadding = + v ;
			}
			else if ( k === 'g' ) {
				// Group separator
				FLOAT_MODES.groupSeparator = v || ' ' ;
			}
			else if ( ! k ) {
				if ( v[ 0 ] === '.' ) {
					// Rounding after the decimal
					let lv = v[ v.length - 1 ] ;

					// Zero-right padding?
					if ( lv === '!' ) {
						FLOAT_MODES.rounding = FLOAT_MODES.rightPadding = parseInt( v.slice( 1 , -1 ) , 10 ) || 0 ;
					}
					else if ( lv === '?' ) {
						FLOAT_MODES.rounding = FLOAT_MODES.rightPadding = parseInt( v.slice( 1 , -1 ) , 10 ) || 0 ;
						FLOAT_MODES.rightPaddingOnlyIfDecimal = true ;
					}
					else {
						FLOAT_MODES.rounding = parseInt( v.slice( 1 ) , 10 ) || 0 ;
					}
				}
				else if ( v[ v.length - 1 ] === '.' ) {
					// Rounding before the decimal
					FLOAT_MODES.rounding = -parseInt( v.slice( 0 , -1 ) , 10 ) || 0 ;
				}
				else {
					// Precision, but only if integer
					FLOAT_MODES.precision = parseInt( v , 10 ) || null ;
				}
			}
		}
	}

	return FLOAT_MODES ;
}



const STRING_MODES = {
	empty: false
} ;

// Generic number modes
function stringModeArg( modeArg ) {
	STRING_MODES.empty = false ;

	if ( modeArg ) {
		for ( let [ , k , v ] of modeArg.matchAll( MODE_ARG_FORMAT_REGEX ) ) {
			if ( k === 'e' ) {
				// Empty mode:
				STRING_MODES.empty = true ;
			}
		}
	}

	return STRING_MODES ;
}



const DATE_TIME_MODES = {
	useAbbreviation: false ,
	rightPadding: 0 ,
	rightPaddingOnlyIfDecimal: false ,
	years: true ,
	months: true ,
	days: true ,
	hours: true ,
	minutes: true ,
	seconds: true
} ;

// Generic number modes
function dateTimeModeArg( modeArg ) {
	DATE_TIME_MODES.rightPadding = 0 ;
	DATE_TIME_MODES.rightPaddingOnlyIfDecimal = false ;
	DATE_TIME_MODES.rounding = 0 ;
	DATE_TIME_MODES.roundingType = -1 ;
	DATE_TIME_MODES.years = DATE_TIME_MODES.months = DATE_TIME_MODES.days = false ;
	DATE_TIME_MODES.hours = DATE_TIME_MODES.minutes = DATE_TIME_MODES.seconds = false ;
	DATE_TIME_MODES.useAbbreviation = false ;

	var hasSelector = false ;

	if ( modeArg ) {
		for ( let [ , k , v ] of modeArg.matchAll( MODE_ARG_FORMAT_REGEX ) ) {
			if ( k === 'T' ) {
				DATE_TIME_MODES.years = DATE_TIME_MODES.months = DATE_TIME_MODES.days = false ;
				DATE_TIME_MODES.hours = DATE_TIME_MODES.minutes = DATE_TIME_MODES.seconds = true ;
				hasSelector = true ;
			}
			else if ( k === 'D' ) {
				DATE_TIME_MODES.years = DATE_TIME_MODES.months = DATE_TIME_MODES.days = true ;
				DATE_TIME_MODES.hours = DATE_TIME_MODES.minutes = DATE_TIME_MODES.seconds = false ;
				hasSelector = true ;
			}
			else if ( k === 'Y' ) {
				DATE_TIME_MODES.years = true ;
				hasSelector = true ;
			}
			else if ( k === 'M' ) {
				DATE_TIME_MODES.months = true ;
				hasSelector = true ;
			}
			else if ( k === 'd' ) {
				DATE_TIME_MODES.days = true ;
				hasSelector = true ;
			}
			else if ( k === 'h' ) {
				DATE_TIME_MODES.hours = true ;
				hasSelector = true ;
			}
			else if ( k === 'm' ) {
				DATE_TIME_MODES.minutes = true ;
				hasSelector = true ;
			}
			else if ( k === 's' ) {
				DATE_TIME_MODES.seconds = true ;
				hasSelector = true ;
			}
			else if ( k === 'r' ) {
				DATE_TIME_MODES.roundingType = 0 ;
			}
			else if ( k === 'f' ) {
				DATE_TIME_MODES.roundingType = -1 ;
			}
			else if ( k === 'c' ) {
				DATE_TIME_MODES.roundingType = 1 ;
			}
			else if ( k === 'a' ) {
				DATE_TIME_MODES.useAbbreviation = true ;
			}
			else if ( ! k ) {
				if ( v[ 0 ] === '.' ) {
					// Rounding after the decimal
					let lv = v[ v.length - 1 ] ;

					// Zero-right padding?
					if ( lv === '!' ) {
						DATE_TIME_MODES.rounding = DATE_TIME_MODES.rightPadding = parseInt( v.slice( 1 , -1 ) , 10 ) || 0 ;
					}
					else if ( lv === '?' ) {
						DATE_TIME_MODES.rounding = DATE_TIME_MODES.rightPadding = parseInt( v.slice( 1 , -1 ) , 10 ) || 0 ;
						DATE_TIME_MODES.rightPaddingOnlyIfDecimal = true ;
					}
					else {
						DATE_TIME_MODES.rounding = parseInt( v.slice( 1 ) , 10 ) || 0 ;
					}
				}
			}
		}
	}

	if ( ! hasSelector ) {
		DATE_TIME_MODES.years = DATE_TIME_MODES.months = DATE_TIME_MODES.days = true ;
		DATE_TIME_MODES.hours = DATE_TIME_MODES.minutes = DATE_TIME_MODES.seconds = true ;
	}

	return DATE_TIME_MODES ;
}



const TIME_DURATION_MODES = {
	useAbbreviation: false ,
	rightPadding: 0 ,
	rightPaddingOnlyIfDecimal: false ,
	rounding: 0 ,
	roundingType: -1 ,	// -1: floor, 0: round, 1: ceil
	forceHours: false ,
	forceMinutes: false
} ;

// Generic number modes
function timeDurationModeArg( modeArg ) {
	TIME_DURATION_MODES.rightPadding = 0 ;
	TIME_DURATION_MODES.rightPaddingOnlyIfDecimal = false ;
	TIME_DURATION_MODES.rounding = 0 ;
	TIME_DURATION_MODES.roundingType = -1 ;
	TIME_DURATION_MODES.useAbbreviation = TIME_DURATION_MODES.forceHours = TIME_DURATION_MODES.forceMinutes = false ;

	if ( modeArg ) {
		for ( let [ , k , v ] of modeArg.matchAll( MODE_ARG_FORMAT_REGEX ) ) {
			if ( k === 'h' ) {
				TIME_DURATION_MODES.forceHours = TIME_DURATION_MODES.forceMinutes = true ;
			}
			else if ( k === 'm' ) {
				TIME_DURATION_MODES.forceMinutes = true ;
			}
			else if ( k === 'r' ) {
				TIME_DURATION_MODES.roundingType = 0 ;
			}
			else if ( k === 'f' ) {
				TIME_DURATION_MODES.roundingType = -1 ;
			}
			else if ( k === 'c' ) {
				TIME_DURATION_MODES.roundingType = 1 ;
			}
			else if ( k === 'a' ) {
				TIME_DURATION_MODES.useAbbreviation = true ;
			}
			else if ( ! k ) {
				if ( v[ 0 ] === '.' ) {
					// Rounding after the decimal
					let lv = v[ v.length - 1 ] ;

					// Zero-right padding?
					if ( lv === '!' ) {
						TIME_DURATION_MODES.rounding = TIME_DURATION_MODES.rightPadding = parseInt( v.slice( 1 , -1 ) , 10 ) || 0 ;
					}
					else if ( lv === '?' ) {
						TIME_DURATION_MODES.rounding = TIME_DURATION_MODES.rightPadding = parseInt( v.slice( 1 , -1 ) , 10 ) || 0 ;
						TIME_DURATION_MODES.rightPaddingOnlyIfDecimal = true ;
					}
					else {
						TIME_DURATION_MODES.rounding = parseInt( v.slice( 1 ) , 10 ) || 0 ;
					}
				}
			}
		}
	}

	return TIME_DURATION_MODES ;
}



// Generic Natural Mode
function genericNaturalMode( arg , modeArg , delimiters ) {
	var depthLimit = 2 ;

	if ( modeArg ) {
		for ( let [ , k , v ] of modeArg.matchAll( MODE_ARG_FORMAT_REGEX ) ) {
			if ( ! k ) {
				depthLimit = parseInt( v , 10 ) || 1 ;
			}
		}
	}

	return genericNaturalModeRecursive( arg , delimiters , depthLimit , 0 ) ;
}

function genericNaturalModeRecursive( arg , delimiters , depthLimit , depth ) {
	if ( typeof arg === 'string' ) { return arg ; }

	if ( arg === null || arg === undefined || arg === true || arg === false ) {
		return '' + arg ;
	}

	if ( typeof arg === 'number' ) {
		return modes.f( arg , '.3g ' ) ;
	}

	if ( arg instanceof Set ) { arg = [ ... arg ] ; }

	if ( Array.isArray( arg ) ) {
		if ( depth >= depthLimit ) { return '[...]' ; }

		arg = arg.map( e => genericNaturalModeRecursive( e , true , depthLimit , depth + 1 ) ) ;

		if ( delimiters ) { return '[' + arg.join( ',' ) + ']' ; }
		return arg.join( ', ' ) ;
	}

	if ( Buffer.isBuffer( arg ) ) {
		arg = [ ... arg ].map( e => {
			e = e.toString( 16 ) ;
			if ( e.length === 1 ) { e = '0' + e ; }
			return e ;
		} ) ;
		return '<' + arg.join( ' ' ) + '>' ;
	}

	var proto = Object.getPrototypeOf( arg ) ;

	if ( proto === null || proto === Object.prototype ) {
		// Plain objects
		if ( depth >= depthLimit ) { return '{...}' ; }

		arg = Object.entries( arg ).sort( naturalSort )
			.map( e => e[ 0 ] + ': ' + genericNaturalModeRecursive( e[ 1 ] , true , depthLimit , depth + 1 ) ) ;

		if ( delimiters ) { return '{' + arg.join( ', ' ) + '}' ; }
		return arg.join( ', ' ) ;
	}

	if ( typeof arg.inspect === 'function' ) { return arg.inspect() ; }
	if ( typeof arg.toString === 'function' ) { return arg.toString() ; }

	return '(' + arg + ')' ;
}



// Generic inspect
function genericInspectMode( arg , modeArg , options , modeOptions , isInspectError = false ) {
	var outputMaxLength ,
		maxLength ,
		depth = 3 ,
		style = options && options.color ? 'color' : 'none' ;

	if ( modeArg ) {
		for ( let [ , k , v ] of modeArg.matchAll( MODE_ARG_FORMAT_REGEX ) ) {
			if ( k === 'c' ) {
				if ( v === '+' ) { style = 'color' ; }
				else if ( v === '-' ) { style = 'none' ; }
			}
			else if ( k === 'i' ) {
				style = 'inline' ;
			}
			else if ( k === 'l' ) {
				// total output max length
				outputMaxLength = parseInt( v , 10 ) || undefined ;
			}
			else if ( k === 's' ) {
				// string max length
				maxLength = parseInt( v , 10 ) || undefined ;
			}
			else if ( ! k ) {
				depth = parseInt( v , 10 ) || 1 ;
			}
		}
	}

	if ( isInspectError ) {
		return inspectError( Object.assign( {
			depth , style , outputMaxLength , maxLength
		} , modeOptions ) , arg ) ;
	}

	return inspect( Object.assign( {
		depth , style , outputMaxLength , maxLength
	} , modeOptions ) , arg ) ;
}



// From math-kit module
// /!\ Should be updated with the new way the math-kit module do it!!! /!\
const EPSILON = 0.0000000001 ;
const INVERSE_EPSILON = Math.round( 1 / EPSILON ) ;

function epsilonRound( v ) {
	return Math.round( v * INVERSE_EPSILON ) / INVERSE_EPSILON ;
}

function epsilonFloor( v ) {
	return Math.floor( v + EPSILON ) ;
}

// Round with precision
function round( v , step ) {
	// use: v * ( 1 / step )
	// not: v / step
	// reason: epsilon rounding errors
	return epsilonRound( step * Math.round( v * ( 1 / step ) ) ) ;
}


}).call(this)}).call(this,require("buffer").Buffer)
},{"./StringNumber.js":17,"./ansi.js":18,"./escape.js":22,"./inspect.js":25,"./naturalSort.js":32,"./unicode.js":36,"buffer":50}],24:[function(require,module,exports){
/*
	String Kit

	Copyright (c) 2014 - 2021 Cédric Ronvel

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


const fuzzy = {} ;
module.exports = fuzzy ;



fuzzy.score = ( input , pattern ) => {
	if ( input === pattern ) { return 1 ; }
	if ( input.length === 0 || pattern.length === 0 ) { return 0 ; }
	//return 1 - fuzzy.levenshtein( input , pattern ) / ( pattern.length >= input.length ? pattern.length : input.length ) ;
	return Math.max( 0 , 1 - fuzzy.levenshtein( input , pattern ) / pattern.length ) ;
} ;



const DEFAULT_SCORE_LIMIT = 0 ;
const DEFAULT_TOKEN_DISPARITY_PENALTY = 0.88 ;
// deltaRate should be just above tokenDisparityPenalty
const DEFAULT_DELTA_RATE = 0.9 ;



fuzzy.bestMatch = ( input , patterns , options = {} ) => {
	var bestScore = options.scoreLimit || DEFAULT_SCORE_LIMIT ,
		i , iMax , currentScore , currentPattern ,
		bestIndex = -1 ,
		bestPattern = null ;

	for ( i = 0 , iMax = patterns.length ; i < iMax ; i ++ ) {
		currentPattern = patterns[ i ] ;
		currentScore = fuzzy.score( input , currentPattern ) ;
		if ( currentScore === 1 ) { return options.indexOf ? i : currentPattern ; }
		if ( currentScore > bestScore ) {
			bestScore = currentScore ;
			bestPattern = currentPattern ;
			bestIndex = i ;
		}
	}

	return options.indexOf ? bestIndex : bestPattern ;
} ;



fuzzy.topMatch = ( input , patterns , options = {} ) => {
	var scoreLimit = options.scoreLimit || DEFAULT_SCORE_LIMIT ,
		deltaRate = options.deltaRate || DEFAULT_DELTA_RATE ,
		i , iMax , patternScores ;

	patternScores = patterns.map( ( pattern , index ) => ( { pattern , index , score: fuzzy.score( input , pattern ) } ) ) ;
	patternScores.sort( ( a , b ) => b.score - a.score ) ;

	//console.log( patternScores ) ;

	if ( patternScores[ 0 ].score <= scoreLimit ) { return [] ; }
	scoreLimit = Math.max( scoreLimit , patternScores[ 0 ].score * deltaRate ) ;

	for ( i = 1 , iMax = patternScores.length ; i < iMax ; i ++ ) {
		if ( patternScores[ i ].score < scoreLimit ) {
			patternScores.length = i ;
			break ;
		}
	}

	return options.indexOf ?
		patternScores.map( e => e.index ) :
		patternScores.map( e => e.pattern ) ;
} ;



const englishBlackList = new Set( [
	'a' , 'an' , 'the' , 'this' , 'that' , 'those' , 'some' ,
	'of' , 'in' , 'on' , 'at' ,
	'my' , 'your' , 'her' , 'his' , 'its' , 'our' , 'their'
] ) ;

function tokenize( str , blackList = englishBlackList ) {
	return str.split( /[ '"/|,:_-]+/g ).filter( s => s && ! blackList.has( s ) ) ;
}



// This is almost the same code than .topTokenMatch(): both must be in sync
fuzzy.bestTokenMatch = ( input , patterns , options = {} ) => {
	var scoreLimit = options.scoreLimit || DEFAULT_SCORE_LIMIT ,
		tokenDisparityPenalty = options.tokenDisparityPenalty || DEFAULT_TOKEN_DISPARITY_PENALTY ,
		i , iMax , j , jMax , z , zMax ,
		currentPattern , currentPatternTokens , currentPatternToken , currentPatternScore ,
		bestPatternScore = scoreLimit ,
		//currentPatternScores = [] ,
		currentInputToken , currentScore ,
		inputTokens = tokenize( input ) ,
		bestScore ,
		bestIndex = -1 ,
		bestPattern = null ;

	//console.log( inputTokens ) ;
	if ( ! inputTokens.length || ! patterns.length ) { return options.indexOf ? bestIndex : bestPattern ; }

	for ( i = 0 , iMax = patterns.length ; i < iMax ; i ++ ) {
		currentPattern = patterns[ i ] ;
		currentPatternTokens = tokenize( currentPattern ) ;
		//currentPatternScores.length = 0 ;
		currentPatternScore = 0 ;

		for ( j = 0 , jMax = inputTokens.length ; j < jMax ; j ++ ) {
			currentInputToken = inputTokens[ j ] ;
			bestScore = 0 ;

			for ( z = 0 , zMax = currentPatternTokens.length ; z < zMax ; z ++ ) {
				currentPatternToken = currentPatternTokens[ z ] ;
				currentScore = fuzzy.score( currentInputToken , currentPatternToken ) ;

				if ( currentScore > bestScore ) {
					bestScore = currentScore ;
					if ( currentScore === 1 ) { break ; }
				}
			}

			//currentPatternScores[ j ] = bestScore ;
			currentPatternScore += bestScore ;
		}

		//currentPatternScore = Math.hypot( ... currentPatternScores ) ;
		currentPatternScore /= inputTokens.length ;

		// Apply a small penalty if there isn't enough tokens
		if ( inputTokens.length !== currentPatternTokens.length ) {
			currentPatternScore *= tokenDisparityPenalty ** Math.abs( currentPatternTokens.length - inputTokens.length ) ;
		}

		//console.log( currentPattern + ': ' + currentPatternScore ) ;
		if ( currentPatternScore > bestPatternScore ) {
			bestPatternScore = currentPatternScore ;
			bestPattern = currentPattern ;
			bestIndex = i ;
		}
	}

	return options.indexOf ? bestIndex : bestPattern ;
} ;



// This is almost the same code than .bestTokenMatch(): both must be in sync
// deltaRate should be just above tokenDisparityPenalty
fuzzy.topTokenMatch = ( input , patterns , options = {} ) => {
	var scoreLimit = options.scoreLimit || DEFAULT_SCORE_LIMIT ,
		tokenDisparityPenalty = options.tokenDisparityPenalty || DEFAULT_TOKEN_DISPARITY_PENALTY ,
		deltaRate = options.deltaRate || DEFAULT_DELTA_RATE ,
		i , iMax , j , jMax , z , zMax ,
		currentPattern , currentPatternTokens , currentPatternToken , currentPatternScore ,
		currentInputToken , currentScore ,
		inputTokens = tokenize( input ) ,
		bestScore ,
		patternScores = [] ;

	//console.log( inputTokens ) ;
	if ( ! inputTokens.length || ! patterns.length ) { return [] ; }

	for ( i = 0 , iMax = patterns.length ; i < iMax ; i ++ ) {
		currentPattern = patterns[ i ] ;
		currentPatternTokens = tokenize( currentPattern ) ;
		//currentPatternScores.length = 0 ;
		currentPatternScore = 0 ;

		for ( j = 0 , jMax = inputTokens.length ; j < jMax ; j ++ ) {
			currentInputToken = inputTokens[ j ] ;
			bestScore = 0 ;

			for ( z = 0 , zMax = currentPatternTokens.length ; z < zMax ; z ++ ) {
				currentPatternToken = currentPatternTokens[ z ] ;
				currentScore = fuzzy.score( currentInputToken , currentPatternToken ) ;

				if ( currentScore > bestScore ) {
					bestScore = currentScore ;
					if ( currentScore === 1 ) { break ; }
				}
			}

			//currentPatternScores[ j ] = bestScore ;
			currentPatternScore += bestScore ;
		}

		//currentPatternScore = Math.hypot( ... currentPatternScores ) ;
		currentPatternScore /= inputTokens.length ;

		// Apply a small penalty if there isn't enough tokens
		if ( inputTokens.length !== currentPatternTokens.length ) {
			currentPatternScore *= tokenDisparityPenalty ** Math.abs( currentPatternTokens.length - inputTokens.length ) ;
		}

		patternScores.push( { pattern: currentPattern , index: i , score: currentPatternScore } ) ;
	}

	patternScores.sort( ( a , b ) => b.score - a.score ) ;
	//console.log( "Before truncating:" , patternScores ) ;

	if ( patternScores[ 0 ].score <= scoreLimit ) { return [] ; }
	scoreLimit = Math.max( scoreLimit , patternScores[ 0 ].score * deltaRate ) ;

	for ( i = 1 , iMax = patternScores.length ; i < iMax ; i ++ ) {
		if ( patternScores[ i ].score < scoreLimit ) {
			patternScores.length = i ;
			break ;
		}
	}

	//console.log( "After truncating:" , patternScores ) ;

	return options.indexOf ?
		patternScores.map( e => e.index ) :
		patternScores.map( e => e.pattern ) ;
} ;



// The .levenshtein() function is derivated from https://github.com/sindresorhus/leven by Sindre Sorhus (MIT License)
const _tracker = [] ;
const _leftCharCodeCache = [] ;

fuzzy.levenshtein = ( left , right ) => {
	if ( left === right ) { return 0 ; }

	// Swapping the strings if `a` is longer than `b` so we know which one is the
	// shortest & which one is the longest
	if ( left.length > right.length ) {
		let swap = left ;
		left = right ;
		right = swap ;
	}

	let leftLength = left.length ;
	let rightLength = right.length ;

	// Performing suffix trimming:
	// We can linearly drop suffix common to both strings since they
	// don't increase distance at all
	while ( leftLength > 0 && ( left.charCodeAt( leftLength - 1 ) === right.charCodeAt( rightLength - 1 ) ) ) {
		leftLength -- ;
		rightLength -- ;
	}

	// Performing prefix trimming
	// We can linearly drop prefix common to both strings since they
	// don't increase distance at all
	let start = 0 ;

	while ( start < leftLength && ( left.charCodeAt( start ) === right.charCodeAt( start ) ) ) {
		start ++ ;
	}

	leftLength -= start ;
	rightLength -= start ;

	if ( leftLength === 0 ) { return rightLength ; }

	let rightCharCode ;
	let result ;
	let temp ;
	let temp2 ;
	let i = 0 ;
	let j = 0 ;

	while ( i < leftLength ) {
		_leftCharCodeCache[ i ] = left.charCodeAt( start + i ) ;
		_tracker[ i ] = ++ i ;
	}

	while ( j < rightLength ) {
		rightCharCode = right.charCodeAt( start + j ) ;
		temp = j ++ ;
		result = j ;

		for ( i = 0 ; i < leftLength ; i ++ ) {
			temp2 = rightCharCode === _leftCharCodeCache[ i ] ? temp : temp + 1 ;
			temp = _tracker[ i ] ;
			// eslint-disable-next-line no-nested-ternary
			result = _tracker[ i ] = temp > result   ?   temp2 > result ? result + 1 : temp2   :   temp2 > temp ? temp + 1 : temp2 ;
		}
	}

	return result ;
} ;


},{}],25:[function(require,module,exports){
(function (Buffer,process){(function (){
/*
	String Kit

	Copyright (c) 2014 - 2021 Cédric Ronvel

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

/*
	Variable inspector.
*/

"use strict" ;



const escape = require( './escape.js' ) ;
const ansi = require( './ansi.js' ) ;

const EMPTY = {} ;
const TRIVIAL_CONSTRUCTOR = new Set( [ Object , Array ] ) ;



/*
	Inspect a variable, return a string ready to be displayed with console.log(), or even as an HTML output.

	Options:
		* style:
			* 'none': (default) normal output suitable for console.log() or writing in a file
			* 'inline': like 'none', but without newlines
			* 'color': colorful output suitable for terminal
			* 'html': html output
			* any object: full controle, inheriting from 'none'
		* tab: `string` override the tab of the style
		* depth: depth limit, default: 3
		* maxLength: length limit for strings, default: 250
		* outputMaxLength: length limit for the inspect output string, default: 5000
		* noFunc: do not display functions
		* noDescriptor: do not display descriptor information
		* noArrayProperty: do not display array properties
		* noIndex: do not display array indexes
		* bulletIndex: do not display array indexes, instead display a bullet: *
		* noType: do not display type and constructor
		* noTypeButConstructor: do not display type, display non-trivial constructor (not Object or Array, but all others)
		* enumOnly: only display enumerable properties
		* funcDetails: display function's details
		* proto: display object's prototype
		* sort: sort the keys
		* noMarkup: don't add Javascript/JSON markup: {}[],"
		* minimal: imply noFunc: true, noDescriptor: true, noType: true, noArrayProperty: true, enumOnly: true, proto: false and funcDetails: false.
		  Display a minimal JSON-like output
		* minimalPlusConstructor: like minimal, but output non-trivial constructor
		* protoBlackList: `Set` of blacklisted object prototype (will not recurse inside it)
		* propertyBlackList: `Set` of blacklisted property names (will not even display it)
		* useInspect: use .inspect() method when available on an object (default to false)
		* useInspectPropertyBlackList: if set and if the object to be inspected has an 'inspectPropertyBlackList' property which value is a `Set`,
		  use it like the 'propertyBlackList' option
*/

function inspect( options , variable ) {
	if ( arguments.length < 2 ) { variable = options ; options = {} ; }
	else if ( ! options || typeof options !== 'object' ) { options = {} ; }

	var runtime = { depth: 0 , ancestors: [] } ;

	if ( ! options.style ) { options.style = inspectStyle.none ; }
	else if ( typeof options.style === 'string' ) { options.style = inspectStyle[ options.style ] ; }
	// Too slow:
	//else { options.style = Object.assign( {} , inspectStyle.none , options.style ) ; }

	if ( options.depth === undefined ) { options.depth = 3 ; }
	if ( options.maxLength === undefined ) { options.maxLength = 250 ; }
	if ( options.outputMaxLength === undefined ) { options.outputMaxLength = 5000 ; }

	// /!\ nofunc is deprecated
	if ( options.nofunc ) { options.noFunc = true ; }

	if ( options.minimal ) {
		options.noFunc = true ;
		options.noDescriptor = true ;
		options.noType = true ;
		options.noArrayProperty = true ;
		options.enumOnly = true ;
		options.proto = false ;
		options.funcDetails = false ;
	}

	if ( options.minimalPlusConstructor ) {
		options.noFunc = true ;
		options.noDescriptor = true ;
		options.noTypeButConstructor = true ;
		options.noArrayProperty = true ;
		options.enumOnly = true ;
		options.proto = false ;
		options.funcDetails = false ;
	}

	var str = inspect_( runtime , options , variable ) ;

	if ( str.length > options.outputMaxLength ) {
		str = options.style.truncate( str , options.outputMaxLength ) ;
	}

	return str ;
}

exports.inspect = inspect ;



function inspect_( runtime , options , variable ) {
	var i , funcName , length , proto , propertyList , isTrivialConstructor , constructor , keyIsProperty ,
		type , pre , isArray , isFunc , specialObject ,
		str = '' , key = '' , descriptorStr = '' , indent = '' ,
		descriptor , nextAncestors ;

	// Prepare things (indentation, key, descriptor, ... )

	type = typeof variable ;

	if ( runtime.depth ) {
		indent = ( options.tab ?? options.style.tab ).repeat( options.noMarkup ? runtime.depth - 1 : runtime.depth ) ;
	}

	if ( type === 'function' && options.noFunc ) { return '' ; }

	if ( runtime.key !== undefined ) {
		if ( runtime.descriptor ) {
			descriptorStr = [] ;

			if ( runtime.descriptor.error ) {
				descriptorStr = '[' + runtime.descriptor.error + ']' ;
			}
			else {
				if ( ! runtime.descriptor.configurable ) { descriptorStr.push( '-conf' ) ; }
				if ( ! runtime.descriptor.enumerable ) { descriptorStr.push( '-enum' ) ; }

				// Already displayed by runtime.forceType
				//if ( runtime.descriptor.get || runtime.descriptor.set ) { descriptorStr.push( 'getter/setter' ) ; } else
				if ( ! runtime.descriptor.writable ) { descriptorStr.push( '-w' ) ; }

				//if ( descriptorStr.length ) { descriptorStr = '(' + descriptorStr.join( ' ' ) + ')' ; }
				if ( descriptorStr.length ) { descriptorStr = descriptorStr.join( ' ' ) ; }
				else { descriptorStr = '' ; }
			}
		}

		if ( runtime.keyIsProperty ) {
			if ( ! options.noMarkup && keyNeedingQuotes( runtime.key ) ) {
				key = '"' + options.style.key( runtime.key ) + '": ' ;
			}
			else {
				key = options.style.key( runtime.key ) + ': ' ;
			}
		}
		else if ( options.bulletIndex ) {
			key = ( typeof options.bulletIndex === 'string' ? options.bulletIndex : '*' ) + ' ' ;
		}
		else if ( ! options.noIndex ) {
			key = options.style.index( runtime.key ) ;
		}

		if ( descriptorStr ) { descriptorStr = ' ' + options.style.type( descriptorStr ) ; }
	}

	pre = runtime.noPre ? '' : indent + key ;


	// Describe the current variable

	if ( variable === undefined ) {
		str += pre + options.style.constant( 'undefined' ) + descriptorStr + options.style.newline ;
	}
	else if ( variable === EMPTY ) {
		str += pre + options.style.constant( '[empty]' ) + descriptorStr + options.style.newline ;
	}
	else if ( variable === null ) {
		str += pre + options.style.constant( 'null' ) + descriptorStr + options.style.newline ;
	}
	else if ( variable === false ) {
		str += pre + options.style.constant( 'false' ) + descriptorStr + options.style.newline ;
	}
	else if ( variable === true ) {
		str += pre + options.style.constant( 'true' ) + descriptorStr + options.style.newline ;
	}
	else if ( type === 'number' ) {
		str += pre + options.style.number( variable.toString() ) +
			( options.noType || options.noTypeButConstructor ? '' : ' ' + options.style.type( 'number' ) ) +
			descriptorStr + options.style.newline ;
	}
	else if ( type === 'string' ) {
		if ( variable.length > options.maxLength ) {
			str += pre + ( options.noMarkup ? '' : '"' ) + options.style.string( escape.control( variable.slice( 0 , options.maxLength - 1 ) ) ) + '…' + ( options.noMarkup ? '' : '"' ) +
				( options.noType || options.noTypeButConstructor ? '' : ' ' + options.style.type( 'string' ) + options.style.length( '(' + variable.length + ' - TRUNCATED)' ) ) +
				descriptorStr + options.style.newline ;
		}
		else {
			str += pre + ( options.noMarkup ? '' : '"' ) + options.style.string( escape.control( variable ) ) + ( options.noMarkup ? '' : '"' ) +
				( options.noType || options.noTypeButConstructor ? '' : ' ' + options.style.type( 'string' ) + options.style.length( '(' + variable.length + ')' ) ) +
				descriptorStr + options.style.newline ;
		}
	}
	else if ( Buffer.isBuffer( variable ) ) {
		str += pre + options.style.inspect( variable.inspect() ) +
			( options.noType ? '' : ' ' + options.style.type( 'Buffer' ) + options.style.length( '(' + variable.length + ')' ) ) +
			descriptorStr + options.style.newline ;
	}
	else if ( type === 'object' || type === 'function' ) {
		funcName = length = '' ;
		isFunc = false ;

		if ( type === 'function' ) {
			isFunc = true ;
			funcName = ' ' + options.style.funcName( ( variable.name ? variable.name : '(anonymous)' ) ) ;
			length = options.style.length( '(' + variable.length + ')' ) ;
		}

		isArray = false ;

		if ( Array.isArray( variable ) ) {
			isArray = true ;
			length = options.style.length( '(' + variable.length + ')' ) ;
		}

		if ( ! variable.constructor ) { constructor = '(no constructor)' ; }
		else if ( ! variable.constructor.name ) { constructor = '(anonymous)' ; }
		else { constructor = variable.constructor.name ; }

		isTrivialConstructor = ! variable.constructor || TRIVIAL_CONSTRUCTOR.has( variable.constructor ) ;

		constructor = options.style.constructorName( constructor ) ;
		proto = Object.getPrototypeOf( variable ) ;

		str += pre ;

		if ( ! options.noType && ( ! options.noTypeButConstructor || ! isTrivialConstructor ) ) {
			if ( runtime.forceType && ! options.noType && ! options.noTypeButConstructor ) {
				str += options.style.type( runtime.forceType ) ;
			}
			else if ( options.noTypeButConstructor ) {
				str += constructor ;
			}
			else {
				str += constructor + funcName + length + ' ' + options.style.type( type ) + descriptorStr ;
			}

			if ( ! isFunc || options.funcDetails ) { str += ' ' ; }	// if no funcDetails imply no space here
		}

		if ( isArray && options.noArrayProperty ) {
			propertyList = [ ... Array( variable.length ).keys() ] ;
		}
		else {
			propertyList = Object.getOwnPropertyNames( variable ) ;
		}

		if ( options.sort ) { propertyList.sort() ; }

		// Special Objects
		specialObject = specialObjectSubstitution( variable , runtime , options ) ;

		if ( options.protoBlackList && options.protoBlackList.has( proto ) ) {
			str += options.style.limit( '[skip]' ) + options.style.newline ;
		}
		else if ( specialObject !== undefined ) {
			if ( typeof specialObject === 'string' ) {
				str += '=> ' + specialObject + options.style.newline ;
			}
			else {
				str += '=> ' + inspect_(
					{
						depth: runtime.depth ,
						ancestors: runtime.ancestors ,
						noPre: true
					} ,
					options ,
					specialObject
				) ;
			}
		}
		else if ( isFunc && ! options.funcDetails ) {
			str += options.style.newline ;
		}
		else if ( ! propertyList.length && ! options.proto ) {
			str += ( options.noMarkup ? '' : isArray ? '[]' : '{}' ) + options.style.newline ;
		}
		else if ( runtime.depth >= options.depth ) {
			str += options.style.limit( '[depth limit]' ) + options.style.newline ;
		}
		else if ( runtime.ancestors.indexOf( variable ) !== -1 ) {
			str += options.style.limit( '[circular]' ) + options.style.newline ;
		}
		else {
			/*
			str +=
				options.noMarkup ? ( isArray && options.noIndex && ! runtime.keyIsProperty ? '' : options.style.newline ) :
				( isArray ? '[' : '{' ) + options.style.newline ;
			//*/
			//*
			str += ( options.noMarkup ? '' : isArray ? '[' : '{'  ) + options.style.newline ;
			//*/

			// Do not use .concat() here, it doesn't works as expected with arrays...
			nextAncestors = runtime.ancestors.slice() ;
			nextAncestors.push( variable ) ;

			for ( i = 0 ; i < propertyList.length && str.length < options.outputMaxLength ; i ++ ) {
				if ( ! isArray && (
					( options.propertyBlackList && options.propertyBlackList.has( propertyList[ i ] ) )
					|| ( options.useInspectPropertyBlackList && ( variable.inspectPropertyBlackList instanceof Set ) && variable.inspectPropertyBlackList.has( propertyList[ i ] ) )
				) ) {
					//str += options.style.limit( '[skip]' ) + options.style.newline ;
					continue ;
				}

				if ( isArray && options.noArrayProperty && ! ( propertyList[ i ] in variable ) ) {
					// Hole in the array (sparse array, item deleted, ...)
					str += inspect_(
						{
							depth: runtime.depth + 1 ,
							ancestors: nextAncestors ,
							key: propertyList[ i ] ,
							keyIsProperty: false
						} ,
						options ,
						EMPTY
					) ;
				}
				else {
					try {
						descriptor = Object.getOwnPropertyDescriptor( variable , propertyList[ i ] ) ;
						// Note: descriptor can be undefined, this happens when the object is a Proxy with a bad implementation:
						// it reports that key (Object.keys()) but doesn't give the descriptor for it.

						if ( descriptor && ! descriptor.enumerable && options.enumOnly ) { continue ; }
						keyIsProperty = ! isArray || ! descriptor.enumerable || isNaN( propertyList[ i ] ) ;

						if ( ! options.noDescriptor && descriptor && ( descriptor.get || descriptor.set ) ) {
							str += inspect_(
								{
									depth: runtime.depth + 1 ,
									ancestors: nextAncestors ,
									key: propertyList[ i ] ,
									keyIsProperty: keyIsProperty ,
									descriptor: descriptor ,
									forceType: 'getter/setter'
								} ,
								options ,
								{ get: descriptor.get , set: descriptor.set }
							) ;
						}
						else {
							str += inspect_(
								{
									depth: runtime.depth + 1 ,
									ancestors: nextAncestors ,
									key: propertyList[ i ] ,
									keyIsProperty: keyIsProperty ,
									descriptor: options.noDescriptor ? undefined : descriptor || { error: "Bad Proxy Descriptor" }
								} ,
								options ,
								variable[ propertyList[ i ] ]
							) ;
						}
					}
					catch ( error ) {
						str += inspect_(
							{
								depth: runtime.depth + 1 ,
								ancestors: nextAncestors ,
								key: propertyList[ i ] ,
								keyIsProperty: keyIsProperty ,
								descriptor: options.noDescriptor ? undefined : descriptor
							} ,
							options ,
							error
						) ;
					}
				}

				if ( i < propertyList.length - 1 ) { str += options.style.comma ; }
			}

			if ( options.proto ) {
				str += inspect_(
					{
						depth: runtime.depth + 1 ,
						ancestors: nextAncestors ,
						key: '__proto__' ,
						keyIsProperty: true
					} ,
					options ,
					proto
				) ;
			}

			str += options.noMarkup ? '' : indent + ( isArray ? ']' : '}' ) + options.style.newline ;
		}
	}


	// Finalizing


	if ( runtime.depth === 0 ) {
		if ( options.style.trim ) { str = str.trim() ; }
		if ( options.style === 'html' ) { str = escape.html( str ) ; }
	}

	return str ;
}



function keyNeedingQuotes( key ) {
	if ( ! key.length ) { return true ; }
	return false ;
}



var promiseStates = [ 'pending' , 'fulfilled' , 'rejected' ] ;



// Some special object are better written down when substituted by something else
function specialObjectSubstitution( object , runtime , options ) {
	if ( typeof object.constructor !== 'function' ) {
		// Some objects have no constructor, e.g.: Object.create(null)
		//console.error( object ) ;
		return ;
	}

	if ( object instanceof String ) {
		return object.toString() ;
	}

	if ( object instanceof RegExp ) {
		return object.toString() ;
	}

	if ( object instanceof Date ) {
		return object.toString() + ' [' + object.getTime() + ']' ;
	}

	if ( typeof Set === 'function' && object instanceof Set ) {
		// This is an ES6 'Set' Object
		return Array.from( object ) ;
	}

	if ( typeof Map === 'function' && object instanceof Map ) {
		// This is an ES6 'Map' Object
		return Array.from( object ) ;
	}

	if ( object instanceof Promise ) {
		if ( process && process.binding && process.binding( 'util' ) && process.binding( 'util' ).getPromiseDetails ) {
			let details = process.binding( 'util' ).getPromiseDetails( object ) ;
			let state =  promiseStates[ details[ 0 ] ] ;
			let str = 'Promise <' + state + '>' ;

			if ( state === 'fulfilled' ) {
				str += ' ' + inspect_(
					{
						depth: runtime.depth ,
						ancestors: runtime.ancestors ,
						noPre: true
					} ,
					options ,
					details[ 1 ]
				) ;
			}
			else if ( state === 'rejected' ) {
				if ( details[ 1 ] instanceof Error ) {
					str += ' ' + inspectError(
						{
							style: options.style ,
							noErrorStack: true
						} ,
						details[ 1 ]
					) ;
				}
				else {
					str += ' ' + inspect_(
						{
							depth: runtime.depth ,
							ancestors: runtime.ancestors ,
							noPre: true
						} ,
						options ,
						details[ 1 ]
					) ;
				}
			}

			return str ;
		}
	}

	if ( object._bsontype ) {
		// This is a MongoDB ObjectID, rather boring to display in its original form
		// due to esoteric characters that confuse both the user and the terminal displaying it.
		// Substitute it to its string representation
		return object.toString() ;
	}

	if ( options.useInspect && typeof object.inspect === 'function' ) {
		return object.inspect() ;
	}

	return ;
}



/*
	Options:
		noErrorStack: set to true if the stack should not be displayed
*/
function inspectError( options , error ) {
	var str = '' , stack , type , code ;

	if ( arguments.length < 2 ) { error = options ; options = {} ; }
	else if ( ! options || typeof options !== 'object' ) { options = {} ; }

	if ( ! options.style ) { options.style = inspectStyle.none ; }
	else if ( typeof options.style === 'string' ) { options.style = inspectStyle[ options.style ] ; }

	if ( ! ( error instanceof Error ) ) {
		str += '[not an Error] ' ;

		if ( typeof error === 'string' ) {
			let maxLength = 5000 ;

			if ( error.length > maxLength ) {
				str += options.style.errorMessage( escape.control( error.slice( 0 , maxLength - 1 ) , true ) ) + '…'
					+ options.style.length( '(' + error.length + ' - TRUNCATED)' )
					+ options.style.newline ;
			}
			else {
				str += options.style.errorMessage( escape.control( error , true ) )
					+ options.style.newline ;
			}

			return str ;
		}
		else if ( ! error || typeof error !== 'object' || ! error.name || typeof error.name !== 'string' || ! error.message || typeof error.message !== 'string' ) {
			str += inspect( options , error ) ;
			return str ;
		}

		// It's an object, but it's compatible with Error, so we can move on...
	}

	if ( error.stack && ! options.noErrorStack ) { stack = inspectStack( options , error.stack ) ; }

	type = error.type || error.constructor.name ;
	code = error.code || error.name || error.errno || error.number ;

	str += options.style.errorType( type ) +
		( code ? ' [' + options.style.errorType( code ) + ']' : '' ) + ': ' ;
	str += options.style.errorMessage( error.message ) + '\n' ;

	if ( stack ) { str += options.style.errorStack( stack ) + '\n' ; }

	if ( error.from ) {
		str += options.style.newline + options.style.errorFromMessage( 'From error:' ) + options.style.newline + inspectError( options , error.from ) ;
	}

	return str ;
}

exports.inspectError = inspectError ;



function inspectStack( options , stack ) {
	if ( arguments.length < 2 ) { stack = options ; options = {} ; }
	else if ( ! options || typeof options !== 'object' ) { options = {} ; }

	if ( ! options.style ) { options.style = inspectStyle.none ; }
	else if ( typeof options.style === 'string' ) { options.style = inspectStyle[ options.style ] ; }

	if ( ! stack ) { return ; }

	if ( ( options.browser || process.browser ) && stack.indexOf( '@' ) !== -1 ) {
		// Assume a Firefox-compatible stack-trace here...
		stack = stack
			.replace( /[</]*(?=@)/g , '' )	// Firefox output some WTF </</</</< stuff in its stack trace -- removing that
			.replace(
				/^\s*([^@]*)\s*@\s*([^\n]*)(?::([0-9]+):([0-9]+))?$/mg ,
				( matches , method , file , line , column ) => {
					return options.style.errorStack( '    at ' ) +
						( method ? options.style.errorStackMethod( method ) + ' ' : '' ) +
						options.style.errorStack( '(' ) +
						( file ? options.style.errorStackFile( file ) : options.style.errorStack( 'unknown' ) ) +
						( line ? options.style.errorStack( ':' ) + options.style.errorStackLine( line ) : '' ) +
						( column ? options.style.errorStack( ':' ) + options.style.errorStackColumn( column ) : '' ) +
						options.style.errorStack( ')' ) ;
				}
			) ;
	}
	else {
		stack = stack.replace( /^[^\n]*\n/ , '' ) ;
		stack = stack.replace(
			/^\s*(at)\s+(?:(?:(async|new)\s+)?([^\s:()[\]\n]+(?:\([^)]+\))?)\s)?(?:\[as ([^\s:()[\]\n]+)\]\s)?(?:\(?([^:()[\]\n]+):([0-9]+):([0-9]+)\)?)?$/mg ,
			( matches , at , keyword , method , as , file , line , column ) => {
				return options.style.errorStack( '    at ' ) +
					( keyword ? options.style.errorStackKeyword( keyword ) + ' ' : '' ) +
					( method ? options.style.errorStackMethod( method ) + ' ' : '' ) +
					( as ? options.style.errorStack( '[as ' ) + options.style.errorStackMethodAs( as ) + options.style.errorStack( '] ' ) : '' ) +
					options.style.errorStack( '(' ) +
					( file ? options.style.errorStackFile( file ) : options.style.errorStack( 'unknown' ) ) +
					( line ? options.style.errorStack( ':' ) + options.style.errorStackLine( line ) : '' ) +
					( column ? options.style.errorStack( ':' ) + options.style.errorStackColumn( column ) : '' ) +
					options.style.errorStack( ')' ) ;
			}
		) ;
	}

	return stack ;
}

exports.inspectStack = inspectStack ;



// Inspect's styles

var inspectStyle = {} ;

var inspectStyleNoop = str => str ;



inspectStyle.none = {
	trim: false ,
	tab: '    ' ,
	newline: '\n' ,
	comma: '' ,
	limit: inspectStyleNoop ,
	type: str => '<' + str + '>' ,
	constant: inspectStyleNoop ,
	funcName: inspectStyleNoop ,
	constructorName: str => '<' + str + '>' ,
	length: inspectStyleNoop ,
	key: inspectStyleNoop ,
	index: str => '[' + str + '] ' ,
	number: inspectStyleNoop ,
	inspect: inspectStyleNoop ,
	string: inspectStyleNoop ,
	errorType: inspectStyleNoop ,
	errorMessage: inspectStyleNoop ,
	errorStack: inspectStyleNoop ,
	errorStackKeyword: inspectStyleNoop ,
	errorStackMethod: inspectStyleNoop ,
	errorStackMethodAs: inspectStyleNoop ,
	errorStackFile: inspectStyleNoop ,
	errorStackLine: inspectStyleNoop ,
	errorStackColumn: inspectStyleNoop ,
	errorFromMessage: inspectStyleNoop ,
	truncate: ( str , maxLength ) => str.slice( 0 , maxLength - 1 ) + '…'
} ;



inspectStyle.inline = Object.assign( {} , inspectStyle.none , {
	trim: true ,
	tab: '' ,
	newline: ' ' ,
	comma: ', ' ,
	length: () => '' ,
	index: () => ''
	//type: () => '' ,
} ) ;



inspectStyle.color = Object.assign( {} , inspectStyle.none , {
	limit: str => ansi.bold + ansi.brightRed + str + ansi.reset ,
	type: str => ansi.italic + ansi.brightBlack + str + ansi.reset ,
	constant: str => ansi.cyan + str + ansi.reset ,
	funcName: str => ansi.italic + ansi.magenta + str + ansi.reset ,
	constructorName: str => ansi.magenta + str + ansi.reset ,
	length: str => ansi.italic + ansi.brightBlack + str + ansi.reset ,
	key: str => ansi.green + str + ansi.reset ,
	index: str => ansi.blue + '[' + str + ']' + ansi.reset + ' ' ,
	number: str => ansi.cyan + str + ansi.reset ,
	inspect: str => ansi.cyan + str + ansi.reset ,
	string: str => ansi.blue + str + ansi.reset ,
	errorType: str => ansi.red + ansi.bold + str + ansi.reset ,
	errorMessage: str => ansi.red + ansi.italic + str + ansi.reset ,
	errorStack: str => ansi.brightBlack + str + ansi.reset ,
	errorStackKeyword: str => ansi.italic + ansi.bold + str + ansi.reset ,
	errorStackMethod: str => ansi.brightYellow + str + ansi.reset ,
	errorStackMethodAs: str => ansi.yellow + str + ansi.reset ,
	errorStackFile: str => ansi.brightCyan + str + ansi.reset ,
	errorStackLine: str => ansi.blue + str + ansi.reset ,
	errorStackColumn: str => ansi.magenta + str + ansi.reset ,
	errorFromMessage: str => ansi.yellow + ansi.underline + str + ansi.reset ,
	truncate: ( str , maxLength ) => {
		var trail = ansi.gray + '…' + ansi.reset ;
		str = str.slice( 0 , maxLength - trail.length ) ;

		// Search for an ansi escape sequence at the end, that could be truncated.
		// The longest one is '\x1b[107m': 6 characters.
		var lastEscape = str.lastIndexOf( '\x1b' ) ;
		if ( lastEscape >= str.length - 6 ) { str = str.slice( 0 , lastEscape ) ; }

		return str + trail ;
	}
} ) ;



inspectStyle.html = Object.assign( {} , inspectStyle.none , {
	tab: '&nbsp;&nbsp;&nbsp;&nbsp;' ,
	newline: '<br />' ,
	limit: str => '<span style="color:red">' + str + '</span>' ,
	type: str => '<i style="color:gray">' + str + '</i>' ,
	constant: str => '<span style="color:cyan">' + str + '</span>' ,
	funcName: str => '<i style="color:magenta">' + str + '</i>' ,
	constructorName: str => '<span style="color:magenta">' + str + '</span>' ,
	length: str => '<i style="color:gray">' + str + '</i>' ,
	key: str => '<span style="color:green">' + str + '</span>' ,
	index: str => '<span style="color:blue">[' + str + ']</span> ' ,
	number: str => '<span style="color:cyan">' + str + '</span>' ,
	inspect: str => '<span style="color:cyan">' + str + '</span>' ,
	string: str => '<span style="color:blue">' + str + '</span>' ,
	errorType: str => '<span style="color:red">' + str + '</span>' ,
	errorMessage: str => '<span style="color:red">' + str + '</span>' ,
	errorStack: str => '<span style="color:gray">' + str + '</span>' ,
	errorStackKeyword: str => '<i>' + str + '</i>' ,
	errorStackMethod: str => '<span style="color:yellow">' + str + '</span>' ,
	errorStackMethodAs: str => '<span style="color:yellow">' + str + '</span>' ,
	errorStackFile: str => '<span style="color:cyan">' + str + '</span>' ,
	errorStackLine: str => '<span style="color:blue">' + str + '</span>' ,
	errorStackColumn: str => '<span style="color:gray">' + str + '</span>' ,
	errorFromMessage: str => '<span style="color:yellow">' + str + '</span>'
} ) ;


}).call(this)}).call(this,{"isBuffer":require("../../../../../../../../opt/node-v20.11.0/lib/node_modules/browserify/node_modules/is-buffer/index.js")},require('_process'))
},{"../../../../../../../../opt/node-v20.11.0/lib/node_modules/browserify/node_modules/is-buffer/index.js":68,"./ansi.js":18,"./escape.js":22,"_process":74}],26:[function(require,module,exports){
module.exports={"😀":"grinning-face","😃":"grinning-face-with-big-eyes","😄":"grinning-face-with-smiling-eyes","😁":"beaming-face-with-smiling-eyes","😆":"grinning-squinting-face","😅":"grinning-face-with-sweat","🤣":"rolling-on-the-floor-laughing","😂":"face-with-tears-of-joy","🙂":"slightly-smiling-face","🙃":"upside-down-face","🫠":"melting-face","😉":"winking-face","😊":"smiling-face-with-smiling-eyes","😇":"smiling-face-with-halo","🥰":"smiling-face-with-hearts","😍":"smiling-face-with-heart-eyes","🤩":"star-struck","😘":"face-blowing-a-kiss","😗":"kissing-face","☺️":"smiling-face","😚":"kissing-face-with-closed-eyes","😙":"kissing-face-with-smiling-eyes","🥲":"smiling-face-with-tear","😋":"face-savoring-food","😛":"face-with-tongue","😜":"winking-face-with-tongue","🤪":"zany-face","😝":"squinting-face-with-tongue","🤑":"money-mouth-face","🤗":"smiling-face-with-open-hands","🤭":"face-with-hand-over-mouth","🫢":"face-with-open-eyes-and-hand-over-mouth","🫣":"face-with-peeking-eye","🤫":"shushing-face","🤔":"thinking-face","🫡":"saluting-face","🤐":"zipper-mouth-face","🤨":"face-with-raised-eyebrow","😐":"neutral-face","😑":"expressionless-face","😶":"face-without-mouth","🫥":"dotted-line-face","😶‍🌫️":"face-in-clouds","😏":"smirking-face","😒":"unamused-face","🙄":"face-with-rolling-eyes","😬":"grimacing-face","😮‍💨":"face-exhaling","🤥":"lying-face","🫨":"shaking-face","😌":"relieved-face","😔":"pensive-face","😪":"sleepy-face","🤤":"drooling-face","😴":"sleeping-face","😷":"face-with-medical-mask","🤒":"face-with-thermometer","🤕":"face-with-head-bandage","🤢":"nauseated-face","🤮":"face-vomiting","🤧":"sneezing-face","🥵":"hot-face","🥶":"cold-face","🥴":"woozy-face","😵":"face-with-crossed-out-eyes","😵‍💫":"face-with-spiral-eyes","🤯":"exploding-head","🤠":"cowboy-hat-face","🥳":"partying-face","🥸":"disguised-face","😎":"smiling-face-with-sunglasses","🤓":"nerd-face","🧐":"face-with-monocle","😕":"confused-face","🫤":"face-with-diagonal-mouth","😟":"worried-face","🙁":"slightly-frowning-face","☹️":"frowning-face","😮":"face-with-open-mouth","😯":"hushed-face","😲":"astonished-face","😳":"flushed-face","🥺":"pleading-face","🥹":"face-holding-back-tears","😦":"frowning-face-with-open-mouth","😧":"anguished-face","😨":"fearful-face","😰":"anxious-face-with-sweat","😥":"sad-but-relieved-face","😢":"crying-face","😭":"loudly-crying-face","😱":"face-screaming-in-fear","😖":"confounded-face","😣":"persevering-face","😞":"disappointed-face","😓":"downcast-face-with-sweat","😩":"weary-face","😫":"tired-face","🥱":"yawning-face","😤":"face-with-steam-from-nose","😡":"enraged-face","😠":"angry-face","🤬":"face-with-symbols-on-mouth","😈":"smiling-face-with-horns","👿":"angry-face-with-horns","💀":"skull","☠️":"skull-and-crossbones","💩":"pile-of-poo","🤡":"clown-face","👹":"ogre","👺":"goblin","👻":"ghost","👽":"alien","👾":"alien-monster","🤖":"robot","😺":"grinning-cat","😸":"grinning-cat-with-smiling-eyes","😹":"cat-with-tears-of-joy","😻":"smiling-cat-with-heart-eyes","😼":"cat-with-wry-smile","😽":"kissing-cat","🙀":"weary-cat","😿":"crying-cat","😾":"pouting-cat","🙈":"see-no-evil-monkey","🙉":"hear-no-evil-monkey","🙊":"speak-no-evil-monkey","💌":"love-letter","💘":"heart-with-arrow","💝":"heart-with-ribbon","💖":"sparkling-heart","💗":"growing-heart","💓":"beating-heart","💞":"revolving-hearts","💕":"two-hearts","💟":"heart-decoration","❣️":"heart-exclamation","💔":"broken-heart","❤️‍🔥":"heart-on-fire","❤️‍🩹":"mending-heart","❤️":"red-heart","🩷":"pink-heart","🧡":"orange-heart","💛":"yellow-heart","💚":"green-heart","💙":"blue-heart","🩵":"light-blue-heart","💜":"purple-heart","🤎":"brown-heart","🖤":"black-heart","🩶":"grey-heart","🤍":"white-heart","💋":"kiss-mark","💯":"hundred-points","💢":"anger-symbol","💥":"collision","💫":"dizzy","💦":"sweat-droplets","💨":"dashing-away","🕳️":"hole","💬":"speech-balloon","👁️‍🗨️":"eye-in-speech-bubble","🗨️":"left-speech-bubble","🗯️":"right-anger-bubble","💭":"thought-balloon","💤":"zzz","👋":"waving-hand","🤚":"raised-back-of-hand","🖐️":"hand-with-fingers-splayed","✋":"raised-hand","🖖":"vulcan-salute","🫱":"rightwards-hand","🫲":"leftwards-hand","🫳":"palm-down-hand","🫴":"palm-up-hand","🫷":"leftwards-pushing-hand","🫸":"rightwards-pushing-hand","👌":"ok-hand","🤌":"pinched-fingers","🤏":"pinching-hand","✌️":"victory-hand","🤞":"crossed-fingers","🫰":"hand-with-index-finger-and-thumb-crossed","🤟":"love-you-gesture","🤘":"sign-of-the-horns","🤙":"call-me-hand","👈":"backhand-index-pointing-left","👉":"backhand-index-pointing-right","👆":"backhand-index-pointing-up","🖕":"middle-finger","👇":"backhand-index-pointing-down","☝️":"index-pointing-up","🫵":"index-pointing-at-the-viewer","👍":"thumbs-up","👎":"thumbs-down","✊":"raised-fist","👊":"oncoming-fist","🤛":"left-facing-fist","🤜":"right-facing-fist","👏":"clapping-hands","🙌":"raising-hands","🫶":"heart-hands","👐":"open-hands","🤲":"palms-up-together","🤝":"handshake","🙏":"folded-hands","✍️":"writing-hand","💅":"nail-polish","🤳":"selfie","💪":"flexed-biceps","🦾":"mechanical-arm","🦿":"mechanical-leg","🦵":"leg","🦶":"foot","👂":"ear","🦻":"ear-with-hearing-aid","👃":"nose","🧠":"brain","🫀":"anatomical-heart","🫁":"lungs","🦷":"tooth","🦴":"bone","👀":"eyes","👁️":"eye","👅":"tongue","👄":"mouth","🫦":"biting-lip","👶":"baby","🧒":"child","👦":"boy","👧":"girl","🧑":"person","👱":"person-blond-hair","👨":"man","🧔":"person-beard","🧔‍♂️":"man-beard","🧔‍♀️":"woman-beard","👨‍🦰":"man-red-hair","👨‍🦱":"man-curly-hair","👨‍🦳":"man-white-hair","👨‍🦲":"man-bald","👩":"woman","👩‍🦰":"woman-red-hair","🧑‍🦰":"person-red-hair","👩‍🦱":"woman-curly-hair","🧑‍🦱":"person-curly-hair","👩‍🦳":"woman-white-hair","🧑‍🦳":"person-white-hair","👩‍🦲":"woman-bald","🧑‍🦲":"person-bald","👱‍♀️":"woman-blond-hair","👱‍♂️":"man-blond-hair","🧓":"older-person","👴":"old-man","👵":"old-woman","🙍":"person-frowning","🙍‍♂️":"man-frowning","🙍‍♀️":"woman-frowning","🙎":"person-pouting","🙎‍♂️":"man-pouting","🙎‍♀️":"woman-pouting","🙅":"person-gesturing-no","🙅‍♂️":"man-gesturing-no","🙅‍♀️":"woman-gesturing-no","🙆":"person-gesturing-ok","🙆‍♂️":"man-gesturing-ok","🙆‍♀️":"woman-gesturing-ok","💁":"person-tipping-hand","💁‍♂️":"man-tipping-hand","💁‍♀️":"woman-tipping-hand","🙋":"person-raising-hand","🙋‍♂️":"man-raising-hand","🙋‍♀️":"woman-raising-hand","🧏":"deaf-person","🧏‍♂️":"deaf-man","🧏‍♀️":"deaf-woman","🙇":"person-bowing","🙇‍♂️":"man-bowing","🙇‍♀️":"woman-bowing","🤦":"person-facepalming","🤦‍♂️":"man-facepalming","🤦‍♀️":"woman-facepalming","🤷":"person-shrugging","🤷‍♂️":"man-shrugging","🤷‍♀️":"woman-shrugging","🧑‍⚕️":"health-worker","👨‍⚕️":"man-health-worker","👩‍⚕️":"woman-health-worker","🧑‍🎓":"student","👨‍🎓":"man-student","👩‍🎓":"woman-student","🧑‍🏫":"teacher","👨‍🏫":"man-teacher","👩‍🏫":"woman-teacher","🧑‍⚖️":"judge","👨‍⚖️":"man-judge","👩‍⚖️":"woman-judge","🧑‍🌾":"farmer","👨‍🌾":"man-farmer","👩‍🌾":"woman-farmer","🧑‍🍳":"cook","👨‍🍳":"man-cook","👩‍🍳":"woman-cook","🧑‍🔧":"mechanic","👨‍🔧":"man-mechanic","👩‍🔧":"woman-mechanic","🧑‍🏭":"factory-worker","👨‍🏭":"man-factory-worker","👩‍🏭":"woman-factory-worker","🧑‍💼":"office-worker","👨‍💼":"man-office-worker","👩‍💼":"woman-office-worker","🧑‍🔬":"scientist","👨‍🔬":"man-scientist","👩‍🔬":"woman-scientist","🧑‍💻":"technologist","👨‍💻":"man-technologist","👩‍💻":"woman-technologist","🧑‍🎤":"singer","👨‍🎤":"man-singer","👩‍🎤":"woman-singer","🧑‍🎨":"artist","👨‍🎨":"man-artist","👩‍🎨":"woman-artist","🧑‍✈️":"pilot","👨‍✈️":"man-pilot","👩‍✈️":"woman-pilot","🧑‍🚀":"astronaut","👨‍🚀":"man-astronaut","👩‍🚀":"woman-astronaut","🧑‍🚒":"firefighter","👨‍🚒":"man-firefighter","👩‍🚒":"woman-firefighter","👮":"police-officer","👮‍♂️":"man-police-officer","👮‍♀️":"woman-police-officer","🕵️":"detective","🕵️‍♂️":"man-detective","🕵️‍♀️":"woman-detective","💂":"guard","💂‍♂️":"man-guard","💂‍♀️":"woman-guard","🥷":"ninja","👷":"construction-worker","👷‍♂️":"man-construction-worker","👷‍♀️":"woman-construction-worker","🫅":"person-with-crown","🤴":"prince","👸":"princess","👳":"person-wearing-turban","👳‍♂️":"man-wearing-turban","👳‍♀️":"woman-wearing-turban","👲":"person-with-skullcap","🧕":"woman-with-headscarf","🤵":"person-in-tuxedo","🤵‍♂️":"man-in-tuxedo","🤵‍♀️":"woman-in-tuxedo","👰":"person-with-veil","👰‍♂️":"man-with-veil","👰‍♀️":"woman-with-veil","🤰":"pregnant-woman","🫃":"pregnant-man","🫄":"pregnant-person","🤱":"breast-feeding","👩‍🍼":"woman-feeding-baby","👨‍🍼":"man-feeding-baby","🧑‍🍼":"person-feeding-baby","👼":"baby-angel","🎅":"santa-claus","🤶":"mrs-claus","🧑‍🎄":"mx-claus","🦸":"superhero","🦸‍♂️":"man-superhero","🦸‍♀️":"woman-superhero","🦹":"supervillain","🦹‍♂️":"man-supervillain","🦹‍♀️":"woman-supervillain","🧙":"mage","🧙‍♂️":"man-mage","🧙‍♀️":"woman-mage","🧚":"fairy","🧚‍♂️":"man-fairy","🧚‍♀️":"woman-fairy","🧛":"vampire","🧛‍♂️":"man-vampire","🧛‍♀️":"woman-vampire","🧜":"merperson","🧜‍♂️":"merman","🧜‍♀️":"mermaid","🧝":"elf","🧝‍♂️":"man-elf","🧝‍♀️":"woman-elf","🧞":"genie","🧞‍♂️":"man-genie","🧞‍♀️":"woman-genie","🧟":"zombie","🧟‍♂️":"man-zombie","🧟‍♀️":"woman-zombie","🧌":"troll","💆":"person-getting-massage","💆‍♂️":"man-getting-massage","💆‍♀️":"woman-getting-massage","💇":"person-getting-haircut","💇‍♂️":"man-getting-haircut","💇‍♀️":"woman-getting-haircut","🚶":"person-walking","🚶‍♂️":"man-walking","🚶‍♀️":"woman-walking","🧍":"person-standing","🧍‍♂️":"man-standing","🧍‍♀️":"woman-standing","🧎":"person-kneeling","🧎‍♂️":"man-kneeling","🧎‍♀️":"woman-kneeling","🧑‍🦯":"person-with-white-cane","👨‍🦯":"man-with-white-cane","👩‍🦯":"woman-with-white-cane","🧑‍🦼":"person-in-motorized-wheelchair","👨‍🦼":"man-in-motorized-wheelchair","👩‍🦼":"woman-in-motorized-wheelchair","🧑‍🦽":"person-in-manual-wheelchair","👨‍🦽":"man-in-manual-wheelchair","👩‍🦽":"woman-in-manual-wheelchair","🏃":"person-running","🏃‍♂️":"man-running","🏃‍♀️":"woman-running","💃":"woman-dancing","🕺":"man-dancing","🕴️":"person-in-suit-levitating","👯":"people-with-bunny-ears","👯‍♂️":"men-with-bunny-ears","👯‍♀️":"women-with-bunny-ears","🧖":"person-in-steamy-room","🧖‍♂️":"man-in-steamy-room","🧖‍♀️":"woman-in-steamy-room","🧗":"person-climbing","🧗‍♂️":"man-climbing","🧗‍♀️":"woman-climbing","🤺":"person-fencing","🏇":"horse-racing","⛷️":"skier","🏂":"snowboarder","🏌️":"person-golfing","🏌️‍♂️":"man-golfing","🏌️‍♀️":"woman-golfing","🏄":"person-surfing","🏄‍♂️":"man-surfing","🏄‍♀️":"woman-surfing","🚣":"person-rowing-boat","🚣‍♂️":"man-rowing-boat","🚣‍♀️":"woman-rowing-boat","🏊":"person-swimming","🏊‍♂️":"man-swimming","🏊‍♀️":"woman-swimming","⛹️":"person-bouncing-ball","⛹️‍♂️":"man-bouncing-ball","⛹️‍♀️":"woman-bouncing-ball","🏋️":"person-lifting-weights","🏋️‍♂️":"man-lifting-weights","🏋️‍♀️":"woman-lifting-weights","🚴":"person-biking","🚴‍♂️":"man-biking","🚴‍♀️":"woman-biking","🚵":"person-mountain-biking","🚵‍♂️":"man-mountain-biking","🚵‍♀️":"woman-mountain-biking","🤸":"person-cartwheeling","🤸‍♂️":"man-cartwheeling","🤸‍♀️":"woman-cartwheeling","🤼":"people-wrestling","🤼‍♂️":"men-wrestling","🤼‍♀️":"women-wrestling","🤽":"person-playing-water-polo","🤽‍♂️":"man-playing-water-polo","🤽‍♀️":"woman-playing-water-polo","🤾":"person-playing-handball","🤾‍♂️":"man-playing-handball","🤾‍♀️":"woman-playing-handball","🤹":"person-juggling","🤹‍♂️":"man-juggling","🤹‍♀️":"woman-juggling","🧘":"person-in-lotus-position","🧘‍♂️":"man-in-lotus-position","🧘‍♀️":"woman-in-lotus-position","🛀":"person-taking-bath","🛌":"person-in-bed","🧑‍🤝‍🧑":"people-holding-hands","👭":"women-holding-hands","👫":"woman-and-man-holding-hands","👬":"men-holding-hands","💏":"kiss","👩‍❤️‍💋‍👨":"kiss-woman-man","👨‍❤️‍💋‍👨":"kiss-man-man","👩‍❤️‍💋‍👩":"kiss-woman-woman","💑":"couple-with-heart","👩‍❤️‍👨":"couple-with-heart-woman-man","👨‍❤️‍👨":"couple-with-heart-man-man","👩‍❤️‍👩":"couple-with-heart-woman-woman","👪":"family","👨‍👩‍👦":"family-man-woman-boy","👨‍👩‍👧":"family-man-woman-girl","👨‍👩‍👧‍👦":"family-man-woman-girl-boy","👨‍👩‍👦‍👦":"family-man-woman-boy-boy","👨‍👩‍👧‍👧":"family-man-woman-girl-girl","👨‍👨‍👦":"family-man-man-boy","👨‍👨‍👧":"family-man-man-girl","👨‍👨‍👧‍👦":"family-man-man-girl-boy","👨‍👨‍👦‍👦":"family-man-man-boy-boy","👨‍👨‍👧‍👧":"family-man-man-girl-girl","👩‍👩‍👦":"family-woman-woman-boy","👩‍👩‍👧":"family-woman-woman-girl","👩‍👩‍👧‍👦":"family-woman-woman-girl-boy","👩‍👩‍👦‍👦":"family-woman-woman-boy-boy","👩‍👩‍👧‍👧":"family-woman-woman-girl-girl","👨‍👦":"family-man-boy","👨‍👦‍👦":"family-man-boy-boy","👨‍👧":"family-man-girl","👨‍👧‍👦":"family-man-girl-boy","👨‍👧‍👧":"family-man-girl-girl","👩‍👦":"family-woman-boy","👩‍👦‍👦":"family-woman-boy-boy","👩‍👧":"family-woman-girl","👩‍👧‍👦":"family-woman-girl-boy","👩‍👧‍👧":"family-woman-girl-girl","🗣️":"speaking-head","👤":"bust-in-silhouette","👥":"busts-in-silhouette","🫂":"people-hugging","👣":"footprints","🐵":"monkey-face","🐒":"monkey","🦍":"gorilla","🦧":"orangutan","🐶":"dog-face","🐕":"dog","🦮":"guide-dog","🐕‍🦺":"service-dog","🐩":"poodle","🐺":"wolf","🦊":"fox","🦝":"raccoon","🐱":"cat-face","🐈":"cat","🐈‍⬛":"black-cat","🦁":"lion","🐯":"tiger-face","🐅":"tiger","🐆":"leopard","🐴":"horse-face","🫎":"moose","🫏":"donkey","🐎":"horse","🦄":"unicorn","🦓":"zebra","🦌":"deer","🦬":"bison","🐮":"cow-face","🐂":"ox","🐃":"water-buffalo","🐄":"cow","🐷":"pig-face","🐖":"pig","🐗":"boar","🐽":"pig-nose","🐏":"ram","🐑":"ewe","🐐":"goat","🐪":"camel","🐫":"two-hump-camel","🦙":"llama","🦒":"giraffe","🐘":"elephant","🦣":"mammoth","🦏":"rhinoceros","🦛":"hippopotamus","🐭":"mouse-face","🐁":"mouse","🐀":"rat","🐹":"hamster","🐰":"rabbit-face","🐇":"rabbit","🐿️":"chipmunk","🦫":"beaver","🦔":"hedgehog","🦇":"bat","🐻":"bear","🐻‍❄️":"polar-bear","🐨":"koala","🐼":"panda","🦥":"sloth","🦦":"otter","🦨":"skunk","🦘":"kangaroo","🦡":"badger","🐾":"paw-prints","🦃":"turkey","🐔":"chicken","🐓":"rooster","🐣":"hatching-chick","🐤":"baby-chick","🐥":"front-facing-baby-chick","🐦":"bird","🐧":"penguin","🕊️":"dove","🦅":"eagle","🦆":"duck","🦢":"swan","🦉":"owl","🦤":"dodo","🪶":"feather","🦩":"flamingo","🦚":"peacock","🦜":"parrot","🪽":"wing","🐦‍⬛":"black-bird","🪿":"goose","🐸":"frog","🐊":"crocodile","🐢":"turtle","🦎":"lizard","🐍":"snake","🐲":"dragon-face","🐉":"dragon","🦕":"sauropod","🦖":"t-rex","🐳":"spouting-whale","🐋":"whale","🐬":"dolphin","🦭":"seal","🐟":"fish","🐠":"tropical-fish","🐡":"blowfish","🦈":"shark","🐙":"octopus","🐚":"spiral-shell","🪸":"coral","🪼":"jellyfish","🐌":"snail","🦋":"butterfly","🐛":"bug","🐜":"ant","🐝":"honeybee","🪲":"beetle","🐞":"lady-beetle","🦗":"cricket","🪳":"cockroach","🕷️":"spider","🕸️":"spider-web","🦂":"scorpion","🦟":"mosquito","🪰":"fly","🪱":"worm","🦠":"microbe","💐":"bouquet","🌸":"cherry-blossom","💮":"white-flower","🪷":"lotus","🏵️":"rosette","🌹":"rose","🥀":"wilted-flower","🌺":"hibiscus","🌻":"sunflower","🌼":"blossom","🌷":"tulip","🪻":"hyacinth","🌱":"seedling","🪴":"potted-plant","🌲":"evergreen-tree","🌳":"deciduous-tree","🌴":"palm-tree","🌵":"cactus","🌾":"sheaf-of-rice","🌿":"herb","☘️":"shamrock","🍀":"four-leaf-clover","🍁":"maple-leaf","🍂":"fallen-leaf","🍃":"leaf-fluttering-in-wind","🪹":"empty-nest","🪺":"nest-with-eggs","🍄":"mushroom","🍇":"grapes","🍈":"melon","🍉":"watermelon","🍊":"tangerine","🍋":"lemon","🍌":"banana","🍍":"pineapple","🥭":"mango","🍎":"red-apple","🍏":"green-apple","🍐":"pear","🍑":"peach","🍒":"cherries","🍓":"strawberry","🫐":"blueberries","🥝":"kiwi-fruit","🍅":"tomato","🫒":"olive","🥥":"coconut","🥑":"avocado","🍆":"eggplant","🥔":"potato","🥕":"carrot","🌽":"ear-of-corn","🌶️":"hot-pepper","🫑":"bell-pepper","🥒":"cucumber","🥬":"leafy-green","🥦":"broccoli","🧄":"garlic","🧅":"onion","🥜":"peanuts","🫘":"beans","🌰":"chestnut","🫚":"ginger-root","🫛":"pea-pod","🍞":"bread","🥐":"croissant","🥖":"baguette-bread","🫓":"flatbread","🥨":"pretzel","🥯":"bagel","🥞":"pancakes","🧇":"waffle","🧀":"cheese-wedge","🍖":"meat-on-bone","🍗":"poultry-leg","🥩":"cut-of-meat","🥓":"bacon","🍔":"hamburger","🍟":"french-fries","🍕":"pizza","🌭":"hot-dog","🥪":"sandwich","🌮":"taco","🌯":"burrito","🫔":"tamale","🥙":"stuffed-flatbread","🧆":"falafel","🥚":"egg","🍳":"cooking","🥘":"shallow-pan-of-food","🍲":"pot-of-food","🫕":"fondue","🥣":"bowl-with-spoon","🥗":"green-salad","🍿":"popcorn","🧈":"butter","🧂":"salt","🥫":"canned-food","🍱":"bento-box","🍘":"rice-cracker","🍙":"rice-ball","🍚":"cooked-rice","🍛":"curry-rice","🍜":"steaming-bowl","🍝":"spaghetti","🍠":"roasted-sweet-potato","🍢":"oden","🍣":"sushi","🍤":"fried-shrimp","🍥":"fish-cake-with-swirl","🥮":"moon-cake","🍡":"dango","🥟":"dumpling","🥠":"fortune-cookie","🥡":"takeout-box","🦀":"crab","🦞":"lobster","🦐":"shrimp","🦑":"squid","🦪":"oyster","🍦":"soft-ice-cream","🍧":"shaved-ice","🍨":"ice-cream","🍩":"doughnut","🍪":"cookie","🎂":"birthday-cake","🍰":"shortcake","🧁":"cupcake","🥧":"pie","🍫":"chocolate-bar","🍬":"candy","🍭":"lollipop","🍮":"custard","🍯":"honey-pot","🍼":"baby-bottle","🥛":"glass-of-milk","☕":"hot-beverage","🫖":"teapot","🍵":"teacup-without-handle","🍶":"sake","🍾":"bottle-with-popping-cork","🍷":"wine-glass","🍸":"cocktail-glass","🍹":"tropical-drink","🍺":"beer-mug","🍻":"clinking-beer-mugs","🥂":"clinking-glasses","🥃":"tumbler-glass","🫗":"pouring-liquid","🥤":"cup-with-straw","🧋":"bubble-tea","🧃":"beverage-box","🧉":"mate","🧊":"ice","🥢":"chopsticks","🍽️":"fork-and-knife-with-plate","🍴":"fork-and-knife","🥄":"spoon","🔪":"kitchen-knife","🫙":"jar","🏺":"amphora","🌍":"globe-showing-europe-africa","🌎":"globe-showing-americas","🌏":"globe-showing-asia-australia","🌐":"globe-with-meridians","🗺️":"world-map","🗾":"map-of-japan","🧭":"compass","🏔️":"snow-capped-mountain","⛰️":"mountain","🌋":"volcano","🗻":"mount-fuji","🏕️":"camping","🏖️":"beach-with-umbrella","🏜️":"desert","🏝️":"desert-island","🏞️":"national-park","🏟️":"stadium","🏛️":"classical-building","🏗️":"building-construction","🧱":"brick","🪨":"rock","🪵":"wood","🛖":"hut","🏘️":"houses","🏚️":"derelict-house","🏠":"house","🏡":"house-with-garden","🏢":"office-building","🏣":"japanese-post-office","🏤":"post-office","🏥":"hospital","🏦":"bank","🏨":"hotel","🏩":"love-hotel","🏪":"convenience-store","🏫":"school","🏬":"department-store","🏭":"factory","🏯":"japanese-castle","🏰":"castle","💒":"wedding","🗼":"tokyo-tower","🗽":"statue-of-liberty","⛪":"church","🕌":"mosque","🛕":"hindu-temple","🕍":"synagogue","⛩️":"shinto-shrine","🕋":"kaaba","⛲":"fountain","⛺":"tent","🌁":"foggy","🌃":"night-with-stars","🏙️":"cityscape","🌄":"sunrise-over-mountains","🌅":"sunrise","🌆":"cityscape-at-dusk","🌇":"sunset","🌉":"bridge-at-night","♨️":"hot-springs","🎠":"carousel-horse","🛝":"playground-slide","🎡":"ferris-wheel","🎢":"roller-coaster","💈":"barber-pole","🎪":"circus-tent","🚂":"locomotive","🚃":"railway-car","🚄":"high-speed-train","🚅":"bullet-train","🚆":"train","🚇":"metro","🚈":"light-rail","🚉":"station","🚊":"tram","🚝":"monorail","🚞":"mountain-railway","🚋":"tram-car","🚌":"bus","🚍":"oncoming-bus","🚎":"trolleybus","🚐":"minibus","🚑":"ambulance","🚒":"fire-engine","🚓":"police-car","🚔":"oncoming-police-car","🚕":"taxi","🚖":"oncoming-taxi","🚗":"automobile","🚘":"oncoming-automobile","🚙":"sport-utility-vehicle","🛻":"pickup-truck","🚚":"delivery-truck","🚛":"articulated-lorry","🚜":"tractor","🏎️":"racing-car","🏍️":"motorcycle","🛵":"motor-scooter","🦽":"manual-wheelchair","🦼":"motorized-wheelchair","🛺":"auto-rickshaw","🚲":"bicycle","🛴":"kick-scooter","🛹":"skateboard","🛼":"roller-skate","🚏":"bus-stop","🛣️":"motorway","🛤️":"railway-track","🛢️":"oil-drum","⛽":"fuel-pump","🛞":"wheel","🚨":"police-car-light","🚥":"horizontal-traffic-light","🚦":"vertical-traffic-light","🛑":"stop-sign","🚧":"construction","⚓":"anchor","🛟":"ring-buoy","⛵":"sailboat","🛶":"canoe","🚤":"speedboat","🛳️":"passenger-ship","⛴️":"ferry","🛥️":"motor-boat","🚢":"ship","✈️":"airplane","🛩️":"small-airplane","🛫":"airplane-departure","🛬":"airplane-arrival","🪂":"parachute","💺":"seat","🚁":"helicopter","🚟":"suspension-railway","🚠":"mountain-cableway","🚡":"aerial-tramway","🛰️":"satellite","🚀":"rocket","🛸":"flying-saucer","🛎️":"bellhop-bell","🧳":"luggage","⌛":"hourglass-done","⏳":"hourglass-not-done","⌚":"watch","⏰":"alarm-clock","⏱️":"stopwatch","⏲️":"timer-clock","🕰️":"mantelpiece-clock","🕛":"twelve-o-clock","🕧":"twelve-thirty","🕐":"one-o-clock","🕜":"one-thirty","🕑":"two-o-clock","🕝":"two-thirty","🕒":"three-o-clock","🕞":"three-thirty","🕓":"four-o-clock","🕟":"four-thirty","🕔":"five-o-clock","🕠":"five-thirty","🕕":"six-o-clock","🕡":"six-thirty","🕖":"seven-o-clock","🕢":"seven-thirty","🕗":"eight-o-clock","🕣":"eight-thirty","🕘":"nine-o-clock","🕤":"nine-thirty","🕙":"ten-o-clock","🕥":"ten-thirty","🕚":"eleven-o-clock","🕦":"eleven-thirty","🌑":"new-moon","🌒":"waxing-crescent-moon","🌓":"first-quarter-moon","🌔":"waxing-gibbous-moon","🌕":"full-moon","🌖":"waning-gibbous-moon","🌗":"last-quarter-moon","🌘":"waning-crescent-moon","🌙":"crescent-moon","🌚":"new-moon-face","🌛":"first-quarter-moon-face","🌜":"last-quarter-moon-face","🌡️":"thermometer","☀️":"sun","🌝":"full-moon-face","🌞":"sun-with-face","🪐":"ringed-planet","⭐":"star","🌟":"glowing-star","🌠":"shooting-star","🌌":"milky-way","☁️":"cloud","⛅":"sun-behind-cloud","⛈️":"cloud-with-lightning-and-rain","🌤️":"sun-behind-small-cloud","🌥️":"sun-behind-large-cloud","🌦️":"sun-behind-rain-cloud","🌧️":"cloud-with-rain","🌨️":"cloud-with-snow","🌩️":"cloud-with-lightning","🌪️":"tornado","🌫️":"fog","🌬️":"wind-face","🌀":"cyclone","🌈":"rainbow","🌂":"closed-umbrella","☂️":"umbrella","☔":"umbrella-with-rain-drops","⛱️":"umbrella-on-ground","⚡":"high-voltage","❄️":"snowflake","☃️":"snowman","⛄":"snowman-without-snow","☄️":"comet","🔥":"fire","💧":"droplet","🌊":"water-wave","🎃":"jack-o-lantern","🎄":"christmas-tree","🎆":"fireworks","🎇":"sparkler","🧨":"firecracker","✨":"sparkles","🎈":"balloon","🎉":"party-popper","🎊":"confetti-ball","🎋":"tanabata-tree","🎍":"pine-decoration","🎎":"japanese-dolls","🎏":"carp-streamer","🎐":"wind-chime","🎑":"moon-viewing-ceremony","🧧":"red-envelope","🎀":"ribbon","🎁":"wrapped-gift","🎗️":"reminder-ribbon","🎟️":"admission-tickets","🎫":"ticket","🎖️":"military-medal","🏆":"trophy","🏅":"sports-medal","🥇":"1st-place-medal","🥈":"2nd-place-medal","🥉":"3rd-place-medal","⚽":"soccer-ball","⚾":"baseball","🥎":"softball","🏀":"basketball","🏐":"volleyball","🏈":"american-football","🏉":"rugby-football","🎾":"tennis","🥏":"flying-disc","🎳":"bowling","🏏":"cricket-game","🏑":"field-hockey","🏒":"ice-hockey","🥍":"lacrosse","🏓":"ping-pong","🏸":"badminton","🥊":"boxing-glove","🥋":"martial-arts-uniform","🥅":"goal-net","⛳":"flag-in-hole","⛸️":"ice-skate","🎣":"fishing-pole","🤿":"diving-mask","🎽":"running-shirt","🎿":"skis","🛷":"sled","🥌":"curling-stone","🎯":"bullseye","🪀":"yo-yo","🪁":"kite","🔫":"water-pistol","🎱":"pool-8-ball","🔮":"crystal-ball","🪄":"magic-wand","🎮":"video-game","🕹️":"joystick","🎰":"slot-machine","🎲":"game-die","🧩":"puzzle-piece","🧸":"teddy-bear","🪅":"pinata","🪩":"mirror-ball","🪆":"nesting-dolls","♠️":"spade-suit","♥️":"heart-suit","♦️":"diamond-suit","♣️":"club-suit","♟️":"chess-pawn","🃏":"joker","🀄":"mahjong-red-dragon","🎴":"flower-playing-cards","🎭":"performing-arts","🖼️":"framed-picture","🎨":"artist-palette","🧵":"thread","🪡":"sewing-needle","🧶":"yarn","🪢":"knot","👓":"glasses","🕶️":"sunglasses","🥽":"goggles","🥼":"lab-coat","🦺":"safety-vest","👔":"necktie","👕":"t-shirt","👖":"jeans","🧣":"scarf","🧤":"gloves","🧥":"coat","🧦":"socks","👗":"dress","👘":"kimono","🥻":"sari","🩱":"one-piece-swimsuit","🩲":"briefs","🩳":"shorts","👙":"bikini","👚":"woman-s-clothes","🪭":"folding-hand-fan","👛":"purse","👜":"handbag","👝":"clutch-bag","🛍️":"shopping-bags","🎒":"backpack","🩴":"thong-sandal","👞":"man-s-shoe","👟":"running-shoe","🥾":"hiking-boot","🥿":"flat-shoe","👠":"high-heeled-shoe","👡":"woman-s-sandal","🩰":"ballet-shoes","👢":"woman-s-boot","🪮":"hair-pick","👑":"crown","👒":"woman-s-hat","🎩":"top-hat","🎓":"graduation-cap","🧢":"billed-cap","🪖":"military-helmet","⛑️":"rescue-worker-s-helmet","📿":"prayer-beads","💄":"lipstick","💍":"ring","💎":"gem-stone","🔇":"muted-speaker","🔈":"speaker-low-volume","🔉":"speaker-medium-volume","🔊":"speaker-high-volume","📢":"loudspeaker","📣":"megaphone","📯":"postal-horn","🔔":"bell","🔕":"bell-with-slash","🎼":"musical-score","🎵":"musical-note","🎶":"musical-notes","🎙️":"studio-microphone","🎚️":"level-slider","🎛️":"control-knobs","🎤":"microphone","🎧":"headphone","📻":"radio","🎷":"saxophone","🪗":"accordion","🎸":"guitar","🎹":"musical-keyboard","🎺":"trumpet","🎻":"violin","🪕":"banjo","🥁":"drum","🪘":"long-drum","🪇":"maracas","🪈":"flute","📱":"mobile-phone","📲":"mobile-phone-with-arrow","☎️":"telephone","📞":"telephone-receiver","📟":"pager","📠":"fax-machine","🔋":"battery","🪫":"low-battery","🔌":"electric-plug","💻":"laptop","🖥️":"desktop-computer","🖨️":"printer","⌨️":"keyboard","🖱️":"computer-mouse","🖲️":"trackball","💽":"computer-disk","💾":"floppy-disk","💿":"optical-disk","📀":"dvd","🧮":"abacus","🎥":"movie-camera","🎞️":"film-frames","📽️":"film-projector","🎬":"clapper-board","📺":"television","📷":"camera","📸":"camera-with-flash","📹":"video-camera","📼":"videocassette","🔍":"magnifying-glass-tilted-left","🔎":"magnifying-glass-tilted-right","🕯️":"candle","💡":"light-bulb","🔦":"flashlight","🏮":"red-paper-lantern","🪔":"diya-lamp","📔":"notebook-with-decorative-cover","📕":"closed-book","📖":"open-book","📗":"green-book","📘":"blue-book","📙":"orange-book","📚":"books","📓":"notebook","📒":"ledger","📃":"page-with-curl","📜":"scroll","📄":"page-facing-up","📰":"newspaper","🗞️":"rolled-up-newspaper","📑":"bookmark-tabs","🔖":"bookmark","🏷️":"label","💰":"money-bag","🪙":"coin","💴":"yen-banknote","💵":"dollar-banknote","💶":"euro-banknote","💷":"pound-banknote","💸":"money-with-wings","💳":"credit-card","🧾":"receipt","💹":"chart-increasing-with-yen","✉️":"envelope","📧":"e-mail","📨":"incoming-envelope","📩":"envelope-with-arrow","📤":"outbox-tray","📥":"inbox-tray","📦":"package","📫":"closed-mailbox-with-raised-flag","📪":"closed-mailbox-with-lowered-flag","📬":"open-mailbox-with-raised-flag","📭":"open-mailbox-with-lowered-flag","📮":"postbox","🗳️":"ballot-box-with-ballot","✏️":"pencil","✒️":"black-nib","🖋️":"fountain-pen","🖊️":"pen","🖌️":"paintbrush","🖍️":"crayon","📝":"memo","💼":"briefcase","📁":"file-folder","📂":"open-file-folder","🗂️":"card-index-dividers","📅":"calendar","📆":"tear-off-calendar","🗒️":"spiral-notepad","🗓️":"spiral-calendar","📇":"card-index","📈":"chart-increasing","📉":"chart-decreasing","📊":"bar-chart","📋":"clipboard","📌":"pushpin","📍":"round-pushpin","📎":"paperclip","🖇️":"linked-paperclips","📏":"straight-ruler","📐":"triangular-ruler","✂️":"scissors","🗃️":"card-file-box","🗄️":"file-cabinet","🗑️":"wastebasket","🔒":"locked","🔓":"unlocked","🔏":"locked-with-pen","🔐":"locked-with-key","🔑":"key","🗝️":"old-key","🔨":"hammer","🪓":"axe","⛏️":"pick","⚒️":"hammer-and-pick","🛠️":"hammer-and-wrench","🗡️":"dagger","⚔️":"crossed-swords","💣":"bomb","🪃":"boomerang","🏹":"bow-and-arrow","🛡️":"shield","🪚":"carpentry-saw","🔧":"wrench","🪛":"screwdriver","🔩":"nut-and-bolt","⚙️":"gear","🗜️":"clamp","⚖️":"balance-scale","🦯":"white-cane","🔗":"link","⛓️":"chains","🪝":"hook","🧰":"toolbox","🧲":"magnet","🪜":"ladder","⚗️":"alembic","🧪":"test-tube","🧫":"petri-dish","🧬":"dna","🔬":"microscope","🔭":"telescope","📡":"satellite-antenna","💉":"syringe","🩸":"drop-of-blood","💊":"pill","🩹":"adhesive-bandage","🩼":"crutch","🩺":"stethoscope","🩻":"x-ray","🚪":"door","🛗":"elevator","🪞":"mirror","🪟":"window","🛏️":"bed","🛋️":"couch-and-lamp","🪑":"chair","🚽":"toilet","🪠":"plunger","🚿":"shower","🛁":"bathtub","🪤":"mouse-trap","🪒":"razor","🧴":"lotion-bottle","🧷":"safety-pin","🧹":"broom","🧺":"basket","🧻":"roll-of-paper","🪣":"bucket","🧼":"soap","🫧":"bubbles","🪥":"toothbrush","🧽":"sponge","🧯":"fire-extinguisher","🛒":"shopping-cart","🚬":"cigarette","⚰️":"coffin","🪦":"headstone","⚱️":"funeral-urn","🧿":"nazar-amulet","🪬":"hamsa","🗿":"moai","🪧":"placard","🪪":"identification-card","🏧":"atm-sign","🚮":"litter-in-bin-sign","🚰":"potable-water","♿":"wheelchair-symbol","🚹":"men-s-room","🚺":"women-s-room","🚻":"restroom","🚼":"baby-symbol","🚾":"water-closet","🛂":"passport-control","🛃":"customs","🛄":"baggage-claim","🛅":"left-luggage","⚠️":"warning","🚸":"children-crossing","⛔":"no-entry","🚫":"prohibited","🚳":"no-bicycles","🚭":"no-smoking","🚯":"no-littering","🚱":"non-potable-water","🚷":"no-pedestrians","📵":"no-mobile-phones","🔞":"no-one-under-eighteen","☢️":"radioactive","☣️":"biohazard","⬆️":"up-arrow","↗️":"up-right-arrow","➡️":"right-arrow","↘️":"down-right-arrow","⬇️":"down-arrow","↙️":"down-left-arrow","⬅️":"left-arrow","↖️":"up-left-arrow","↕️":"up-down-arrow","↔️":"left-right-arrow","↩️":"right-arrow-curving-left","↪️":"left-arrow-curving-right","⤴️":"right-arrow-curving-up","⤵️":"right-arrow-curving-down","🔃":"clockwise-vertical-arrows","🔄":"counterclockwise-arrows-button","🔙":"back-arrow","🔚":"end-arrow","🔛":"on-arrow","🔜":"soon-arrow","🔝":"top-arrow","🛐":"place-of-worship","⚛️":"atom-symbol","🕉️":"om","✡️":"star-of-david","☸️":"wheel-of-dharma","☯️":"yin-yang","✝️":"latin-cross","☦️":"orthodox-cross","☪️":"star-and-crescent","☮️":"peace-symbol","🕎":"menorah","🔯":"dotted-six-pointed-star","🪯":"khanda","♈":"aries","♉":"taurus","♊":"gemini","♋":"cancer","♌":"leo","♍":"virgo","♎":"libra","♏":"scorpio","♐":"sagittarius","♑":"capricorn","♒":"aquarius","♓":"pisces","⛎":"ophiuchus","🔀":"shuffle-tracks-button","🔁":"repeat-button","🔂":"repeat-single-button","▶️":"play-button","⏩":"fast-forward-button","⏭️":"next-track-button","⏯️":"play-or-pause-button","◀️":"reverse-button","⏪":"fast-reverse-button","⏮️":"last-track-button","🔼":"upwards-button","⏫":"fast-up-button","🔽":"downwards-button","⏬":"fast-down-button","⏸️":"pause-button","⏹️":"stop-button","⏺️":"record-button","⏏️":"eject-button","🎦":"cinema","🔅":"dim-button","🔆":"bright-button","📶":"antenna-bars","🛜":"wireless","📳":"vibration-mode","📴":"mobile-phone-off","♀️":"female-sign","♂️":"male-sign","⚧️":"transgender-symbol","✖️":"multiply","➕":"plus","➖":"minus","➗":"divide","🟰":"heavy-equals-sign","♾️":"infinity","‼️":"double-exclamation-mark","⁉️":"exclamation-question-mark","❓":"red-question-mark","❔":"white-question-mark","❕":"white-exclamation-mark","❗":"red-exclamation-mark","〰️":"wavy-dash","💱":"currency-exchange","💲":"heavy-dollar-sign","⚕️":"medical-symbol","♻️":"recycling-symbol","⚜️":"fleur-de-lis","🔱":"trident-emblem","📛":"name-badge","🔰":"japanese-symbol-for-beginner","⭕":"hollow-red-circle","✅":"check-mark-button","☑️":"check-box-with-check","✔️":"check-mark","❌":"cross-mark","❎":"cross-mark-button","➰":"curly-loop","➿":"double-curly-loop","〽️":"part-alternation-mark","✳️":"eight-spoked-asterisk","✴️":"eight-pointed-star","❇️":"sparkle","©️":"copyright","®️":"registered","™️":"trade-mark","#️⃣":"keycap-#","*️⃣":"keycap-*","0️⃣":"keycap-0","1️⃣":"keycap-1","2️⃣":"keycap-2","3️⃣":"keycap-3","4️⃣":"keycap-4","5️⃣":"keycap-5","6️⃣":"keycap-6","7️⃣":"keycap-7","8️⃣":"keycap-8","9️⃣":"keycap-9","🔟":"keycap-10","🔠":"input-latin-uppercase","🔡":"input-latin-lowercase","🔢":"input-numbers","🔣":"input-symbols","🔤":"input-latin-letters","🅰️":"a-button-blood-type","🆎":"ab-button-blood-type","🅱️":"b-button-blood-type","🆑":"cl-button","🆒":"cool-button","🆓":"free-button","ℹ️":"information","🆔":"id-button","Ⓜ️":"circled-m","🆕":"new-button","🆖":"ng-button","🅾️":"o-button-blood-type","🆗":"ok-button","🅿️":"p-button","🆘":"sos-button","🆙":"up-button","🆚":"vs-button","🈁":"japanese-here-button","🈂️":"japanese-service-charge-button","🈷️":"japanese-monthly-amount-button","🈶":"japanese-not-free-of-charge-button","🈯":"japanese-reserved-button","🉐":"japanese-bargain-button","🈹":"japanese-discount-button","🈚":"japanese-free-of-charge-button","🈲":"japanese-prohibited-button","🉑":"japanese-acceptable-button","🈸":"japanese-application-button","🈴":"japanese-passing-grade-button","🈳":"japanese-vacancy-button","㊗️":"japanese-congratulations-button","㊙️":"japanese-secret-button","🈺":"japanese-open-for-business-button","🈵":"japanese-no-vacancy-button","🔴":"red-circle","🟠":"orange-circle","🟡":"yellow-circle","🟢":"green-circle","🔵":"blue-circle","🟣":"purple-circle","🟤":"brown-circle","⚫":"black-circle","⚪":"white-circle","🟥":"red-square","🟧":"orange-square","🟨":"yellow-square","🟩":"green-square","🟦":"blue-square","🟪":"purple-square","🟫":"brown-square","⬛":"black-large-square","⬜":"white-large-square","◼️":"black-medium-square","◻️":"white-medium-square","◾":"black-medium-small-square","◽":"white-medium-small-square","▪️":"black-small-square","▫️":"white-small-square","🔶":"large-orange-diamond","🔷":"large-blue-diamond","🔸":"small-orange-diamond","🔹":"small-blue-diamond","🔺":"red-triangle-pointed-up","🔻":"red-triangle-pointed-down","💠":"diamond-with-a-dot","🔘":"radio-button","🔳":"white-square-button","🔲":"black-square-button","🏁":"chequered-flag","🚩":"triangular-flag","🎌":"crossed-flags","🏴":"black-flag","🏳️":"white-flag","🏳️‍🌈":"rainbow-flag","🏳️‍⚧️":"transgender-flag","🏴‍☠️":"pirate-flag","🇦🇨":"flag-ascension-island","🇦🇩":"flag-andorra","🇦🇪":"flag-united-arab-emirates","🇦🇫":"flag-afghanistan","🇦🇬":"flag-antigua-&-barbuda","🇦🇮":"flag-anguilla","🇦🇱":"flag-albania","🇦🇲":"flag-armenia","🇦🇴":"flag-angola","🇦🇶":"flag-antarctica","🇦🇷":"flag-argentina","🇦🇸":"flag-american-samoa","🇦🇹":"flag-austria","🇦🇺":"flag-australia","🇦🇼":"flag-aruba","🇦🇽":"flag-aland-islands","🇦🇿":"flag-azerbaijan","🇧🇦":"flag-bosnia-&-herzegovina","🇧🇧":"flag-barbados","🇧🇩":"flag-bangladesh","🇧🇪":"flag-belgium","🇧🇫":"flag-burkina-faso","🇧🇬":"flag-bulgaria","🇧🇭":"flag-bahrain","🇧🇮":"flag-burundi","🇧🇯":"flag-benin","🇧🇱":"flag-st-barthelemy","🇧🇲":"flag-bermuda","🇧🇳":"flag-brunei","🇧🇴":"flag-bolivia","🇧🇶":"flag-caribbean-netherlands","🇧🇷":"flag-brazil","🇧🇸":"flag-bahamas","🇧🇹":"flag-bhutan","🇧🇻":"flag-bouvet-island","🇧🇼":"flag-botswana","🇧🇾":"flag-belarus","🇧🇿":"flag-belize","🇨🇦":"flag-canada","🇨🇨":"flag-cocos-keeling-islands","🇨🇩":"flag-congo-kinshasa","🇨🇫":"flag-central-african-republic","🇨🇬":"flag-congo-brazzaville","🇨🇭":"flag-switzerland","🇨🇮":"flag-cote-d-ivoire","🇨🇰":"flag-cook-islands","🇨🇱":"flag-chile","🇨🇲":"flag-cameroon","🇨🇳":"flag-china","🇨🇴":"flag-colombia","🇨🇵":"flag-clipperton-island","🇨🇷":"flag-costa-rica","🇨🇺":"flag-cuba","🇨🇻":"flag-cape-verde","🇨🇼":"flag-curacao","🇨🇽":"flag-christmas-island","🇨🇾":"flag-cyprus","🇨🇿":"flag-czechia","🇩🇪":"flag-germany","🇩🇬":"flag-diego-garcia","🇩🇯":"flag-djibouti","🇩🇰":"flag-denmark","🇩🇲":"flag-dominica","🇩🇴":"flag-dominican-republic","🇩🇿":"flag-algeria","🇪🇦":"flag-ceuta-&-melilla","🇪🇨":"flag-ecuador","🇪🇪":"flag-estonia","🇪🇬":"flag-egypt","🇪🇭":"flag-western-sahara","🇪🇷":"flag-eritrea","🇪🇸":"flag-spain","🇪🇹":"flag-ethiopia","🇪🇺":"flag-european-union","🇫🇮":"flag-finland","🇫🇯":"flag-fiji","🇫🇰":"flag-falkland-islands","🇫🇲":"flag-micronesia","🇫🇴":"flag-faroe-islands","🇫🇷":"flag-france","🇬🇦":"flag-gabon","🇬🇧":"flag-united-kingdom","🇬🇩":"flag-grenada","🇬🇪":"flag-georgia","🇬🇫":"flag-french-guiana","🇬🇬":"flag-guernsey","🇬🇭":"flag-ghana","🇬🇮":"flag-gibraltar","🇬🇱":"flag-greenland","🇬🇲":"flag-gambia","🇬🇳":"flag-guinea","🇬🇵":"flag-guadeloupe","🇬🇶":"flag-equatorial-guinea","🇬🇷":"flag-greece","🇬🇸":"flag-south-georgia-&-south-sandwich-islands","🇬🇹":"flag-guatemala","🇬🇺":"flag-guam","🇬🇼":"flag-guinea-bissau","🇬🇾":"flag-guyana","🇭🇰":"flag-hong-kong-sar-china","🇭🇲":"flag-heard-&-mcdonald-islands","🇭🇳":"flag-honduras","🇭🇷":"flag-croatia","🇭🇹":"flag-haiti","🇭🇺":"flag-hungary","🇮🇨":"flag-canary-islands","🇮🇩":"flag-indonesia","🇮🇪":"flag-ireland","🇮🇱":"flag-israel","🇮🇲":"flag-isle-of-man","🇮🇳":"flag-india","🇮🇴":"flag-british-indian-ocean-territory","🇮🇶":"flag-iraq","🇮🇷":"flag-iran","🇮🇸":"flag-iceland","🇮🇹":"flag-italy","🇯🇪":"flag-jersey","🇯🇲":"flag-jamaica","🇯🇴":"flag-jordan","🇯🇵":"flag-japan","🇰🇪":"flag-kenya","🇰🇬":"flag-kyrgyzstan","🇰🇭":"flag-cambodia","🇰🇮":"flag-kiribati","🇰🇲":"flag-comoros","🇰🇳":"flag-st-kitts-&-nevis","🇰🇵":"flag-north-korea","🇰🇷":"flag-south-korea","🇰🇼":"flag-kuwait","🇰🇾":"flag-cayman-islands","🇰🇿":"flag-kazakhstan","🇱🇦":"flag-laos","🇱🇧":"flag-lebanon","🇱🇨":"flag-st-lucia","🇱🇮":"flag-liechtenstein","🇱🇰":"flag-sri-lanka","🇱🇷":"flag-liberia","🇱🇸":"flag-lesotho","🇱🇹":"flag-lithuania","🇱🇺":"flag-luxembourg","🇱🇻":"flag-latvia","🇱🇾":"flag-libya","🇲🇦":"flag-morocco","🇲🇨":"flag-monaco","🇲🇩":"flag-moldova","🇲🇪":"flag-montenegro","🇲🇫":"flag-st-martin","🇲🇬":"flag-madagascar","🇲🇭":"flag-marshall-islands","🇲🇰":"flag-north-macedonia","🇲🇱":"flag-mali","🇲🇲":"flag-myanmar-burma","🇲🇳":"flag-mongolia","🇲🇴":"flag-macao-sar-china","🇲🇵":"flag-northern-mariana-islands","🇲🇶":"flag-martinique","🇲🇷":"flag-mauritania","🇲🇸":"flag-montserrat","🇲🇹":"flag-malta","🇲🇺":"flag-mauritius","🇲🇻":"flag-maldives","🇲🇼":"flag-malawi","🇲🇽":"flag-mexico","🇲🇾":"flag-malaysia","🇲🇿":"flag-mozambique","🇳🇦":"flag-namibia","🇳🇨":"flag-new-caledonia","🇳🇪":"flag-niger","🇳🇫":"flag-norfolk-island","🇳🇬":"flag-nigeria","🇳🇮":"flag-nicaragua","🇳🇱":"flag-netherlands","🇳🇴":"flag-norway","🇳🇵":"flag-nepal","🇳🇷":"flag-nauru","🇳🇺":"flag-niue","🇳🇿":"flag-new-zealand","🇴🇲":"flag-oman","🇵🇦":"flag-panama","🇵🇪":"flag-peru","🇵🇫":"flag-french-polynesia","🇵🇬":"flag-papua-new-guinea","🇵🇭":"flag-philippines","🇵🇰":"flag-pakistan","🇵🇱":"flag-poland","🇵🇲":"flag-st-pierre-&-miquelon","🇵🇳":"flag-pitcairn-islands","🇵🇷":"flag-puerto-rico","🇵🇸":"flag-palestinian-territories","🇵🇹":"flag-portugal","🇵🇼":"flag-palau","🇵🇾":"flag-paraguay","🇶🇦":"flag-qatar","🇷🇪":"flag-reunion","🇷🇴":"flag-romania","🇷🇸":"flag-serbia","🇷🇺":"flag-russia","🇷🇼":"flag-rwanda","🇸🇦":"flag-saudi-arabia","🇸🇧":"flag-solomon-islands","🇸🇨":"flag-seychelles","🇸🇩":"flag-sudan","🇸🇪":"flag-sweden","🇸🇬":"flag-singapore","🇸🇭":"flag-st-helena","🇸🇮":"flag-slovenia","🇸🇯":"flag-svalbard-&-jan-mayen","🇸🇰":"flag-slovakia","🇸🇱":"flag-sierra-leone","🇸🇲":"flag-san-marino","🇸🇳":"flag-senegal","🇸🇴":"flag-somalia","🇸🇷":"flag-suriname","🇸🇸":"flag-south-sudan","🇸🇹":"flag-sao-tome-&-principe","🇸🇻":"flag-el-salvador","🇸🇽":"flag-sint-maarten","🇸🇾":"flag-syria","🇸🇿":"flag-eswatini","🇹🇦":"flag-tristan-da-cunha","🇹🇨":"flag-turks-&-caicos-islands","🇹🇩":"flag-chad","🇹🇫":"flag-french-southern-territories","🇹🇬":"flag-togo","🇹🇭":"flag-thailand","🇹🇯":"flag-tajikistan","🇹🇰":"flag-tokelau","🇹🇱":"flag-timor-leste","🇹🇲":"flag-turkmenistan","🇹🇳":"flag-tunisia","🇹🇴":"flag-tonga","🇹🇷":"flag-turkey","🇹🇹":"flag-trinidad-&-tobago","🇹🇻":"flag-tuvalu","🇹🇼":"flag-taiwan","🇹🇿":"flag-tanzania","🇺🇦":"flag-ukraine","🇺🇬":"flag-uganda","🇺🇲":"flag-us-outlying-islands","🇺🇳":"flag-united-nations","🇺🇸":"flag-united-states","🇺🇾":"flag-uruguay","🇺🇿":"flag-uzbekistan","🇻🇦":"flag-vatican-city","🇻🇨":"flag-st-vincent-&-grenadines","🇻🇪":"flag-venezuela","🇻🇬":"flag-british-virgin-islands","🇻🇮":"flag-us-virgin-islands","🇻🇳":"flag-vietnam","🇻🇺":"flag-vanuatu","🇼🇫":"flag-wallis-&-futuna","🇼🇸":"flag-samoa","🇽🇰":"flag-kosovo","🇾🇪":"flag-yemen","🇾🇹":"flag-mayotte","🇿🇦":"flag-south-africa","🇿🇲":"flag-zambia","🇿🇼":"flag-zimbabwe","🏴󠁧󠁢󠁥󠁮󠁧󠁿":"flag-england","🏴󠁧󠁢󠁳󠁣󠁴󠁿":"flag-scotland","🏴󠁧󠁢󠁷󠁬󠁳󠁿":"flag-wales"}
},{}],27:[function(require,module,exports){
module.exports={"10":["🔟"],"grin":["😀","😃","😄","😆","😅","😺","😸"],"face":["😀","😃","😄","😁","😆","😅","😂","🙂","🙃","🫠","😉","😊","😇","🥰","😍","😘","😗","☺️","😚","😙","🥲","😋","😛","😜","🤪","😝","🤑","🤗","🤭","🫢","🫣","🤫","🤔","🫡","🤐","🤨","😐","😑","😶","🫥","😶‍🌫️","😏","😒","🙄","😬","😮‍💨","🤥","🫨","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🤧","🥵","🥶","🥴","😵","😵‍💫","🤠","🥳","🥸","😎","🤓","🧐","😕","🫤","😟","🙁","☹️","😮","😯","😲","😳","🥺","🥹","😦","😧","😨","😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠","🤬","😈","👿","🤡","🤛","🤜","🐵","🐶","🐱","🐯","🐴","🐮","🐷","🐭","🐰","🐥","🐲","🌚","🌛","🌜","🌝","🌞","🌬️","📄"],"big":["😃"],"eyes":["😃","😄","😁","😊","😍","😚","😙","🫢","🙄","😵","😵‍💫","😸","😻","👀"],"smile":["😄","😁","🙂","😊","😇","🥰","😍","☺️","😙","🥲","🤗","😎","😈","😸","😻","😼"],"beam":["😁"],"squint":["😆","😝"],"sweat":["😅","😰","😓","💦"],"roll":["🤣","🙄","🧻"],"on":["🤣","🤬","❤️‍🔥","🍖","⛱️","🔛"],"the":["🤣","🤘","🫵"],"floor":["🤣"],"laugh":["🤣"],"tears":["😂","🥹","😹"],"joy":["😂","😹"],"slightly":["🙂","🙁"],"upside":["🙃"],"down":["🙃","🫳","👇","👎","↘️","⬇️","↙️","↕️","⤵️","⏬","🔻"],"melt":["🫠"],"wink":["😉","😜"],"halo":["😇"],"hearts":["🥰","💞","💕"],"heart":["😍","😻","💘","💝","💖","💗","💓","💟","❣️","💔","❤️‍🔥","❤️‍🩹","❤️","🩷","🧡","💛","💚","💙","🩵","💜","🤎","🖤","🩶","🤍","🫶","🫀","💑","👩‍❤️‍👨","👨‍❤️‍👨","👩‍❤️‍👩","♥️"],"star":["🤩","⭐","🌟","🌠","✡️","☪️","🔯","✴️"],"struck":["🤩"],"blow":["😘"],"kiss":["😘","😗","😚","😙","😽","💋","💏","👩‍❤️‍💋‍👨","👨‍❤️‍💋‍👨","👩‍❤️‍💋‍👩"],"closed":["😚","🌂","📕","📫","📪"],"tear":["🥲","📆"],"savore":["😋"],"food":["😋","🥘","🍲","🥫"],"tongue":["😛","😜","😝","👅"],"zany":["🤪"],"money":["🤑","💰","💸"],"mouth":["🤑","🤭","🫢","🤐","😶","🫤","😮","😦","🤬","👄"],"open":["🤗","🫢","😮","😦","👐","📖","📬","📭","📂","🈺"],"hands":["🤗","👏","🙌","🫶","👐","🙏","🧑‍🤝‍🧑","👭","👫","👬"],"hand":["🤭","🫢","👋","🤚","🖐️","✋","🫱","🫲","🫳","🫴","🫷","🫸","👌","🤏","✌️","🫰","🤙","✍️","💁","💁‍♂️","💁‍♀️","🙋","🙋‍♂️","🙋‍♀️","🪭"],"over":["🤭","🫢","🌄"],"and":["🫢","☠️","🫰","👫","🍽️","🍴","⛈️","⚒️","🛠️","🏹","🔩","🛋️","☪️"],"peek":["🫣"],"eye":["🫣","👁️‍🗨️","👁️"],"shush":["🤫"],"think":["🤔"],"salute":["🫡","🖖"],"zipper":["🤐"],"raised":["🤨","🤚","✋","✊","📫","📬"],"eyebrow":["🤨"],"neutral":["😐"],"expressionless":["😑"],"without":["😶","🍵","⛄"],"dotted":["🫥","🔯"],"line":["🫥"],"in":["😶‍🌫️","😱","👁️‍🗨️","🤵","🤵‍♂️","🤵‍♀️","🧑‍🦼","👨‍🦼","👩‍🦼","🧑‍🦽","👨‍🦽","👩‍🦽","🕴️","🧖","🧖‍♂️","🧖‍♀️","🧘","🧘‍♂️","🧘‍♀️","🛌","👤","👥","🍃","⛳","🚮"],"clouds":["😶‍🌫️"],"smirk":["😏"],"unamused":["😒"],"grimace":["😬"],"exhale":["😮‍💨"],"lying":["🤥"],"shake":["🫨"],"relieved":["😌","😥"],"pensive":["😔"],"sleepy":["😪"],"drool":["🤤"],"sleep":["😴"],"medical":["😷","⚕️"],"mask":["😷","🤿"],"thermometer":["🤒","🌡️"],"head":["🤕","🤯","🗣️"],"bandage":["🤕","🩹"],"nauseated":["🤢"],"vomite":["🤮"],"sneez":["🤧"],"hot":["🥵","🌶️","🌭","☕","♨️"],"cold":["🥶"],"woozy":["🥴"],"crossed":["😵","🤞","🫰","⚔️","🎌"],"out":["😵"],"spiral":["😵‍💫","🐚","🗒️","🗓️"],"explode":["🤯"],"cowboy":["🤠"],"hat":["🤠","👒","🎩"],"party":["🥳","🎉"],"disguised":["🥸"],"sunglasses":["😎","🕶️"],"nerd":["🤓"],"monocle":["🧐"],"confused":["😕"],"diagonal":["🫤"],"worried":["😟"],"frown":["🙁","☹️","😦","🙍","🙍‍♂️","🙍‍♀️"],"hushed":["😯"],"astonished":["😲"],"flushed":["😳"],"plead":["🥺"],"hold":["🥹","🧑‍🤝‍🧑","👭","👫","👬"],"back":["🥹","🤚","🔙"],"anguished":["😧"],"fearful":["😨"],"anxious":["😰"],"sad":["😥"],"but":["😥"],"cry":["😢","😭","😿"],"loudly":["😭"],"scream":["😱"],"fear":["😱"],"confounded":["😖"],"persever":["😣"],"disappointed":["😞"],"downcast":["😓"],"weary":["😩","🙀"],"tired":["😫"],"yawn":["🥱"],"steam":["😤","🍜"],"from":["😤"],"nose":["😤","👃","🐽"],"enraged":["😡"],"angry":["😠","👿"],"symbols":["🤬","🔣"],"horns":["😈","👿","🤘"],"skull":["💀","☠️"],"crossbones":["☠️"],"pile":["💩"],"poo":["💩"],"clown":["🤡"],"ogre":["👹"],"goblin":["👺"],"ghost":["👻"],"alien":["👽","👾"],"monster":["👾"],"robot":["🤖"],"cat":["😺","😸","😹","😻","😼","😽","🙀","😿","😾","🐱","🐈","🐈‍⬛"],"wry":["😼"],"pout":["😾","🙎","🙎‍♂️","🙎‍♀️"],"see":["🙈"],"no":["🙈","🙉","🙊","🙅","🙅‍♂️","🙅‍♀️","⛔","🚳","🚭","🚯","🚷","📵","🔞","🈵"],"evil":["🙈","🙉","🙊"],"monkey":["🙈","🙉","🙊","🐵","🐒"],"hear":["🙉","🦻"],"speak":["🙊","🗣️"],"love":["💌","🤟","🏩"],"letter":["💌"],"arrow":["💘","📲","📩","🏹","⬆️","↗️","➡️","↘️","⬇️","↙️","⬅️","↖️","↕️","↔️","↩️","↪️","⤴️","⤵️","🔙","🔚","🔛","🔜","🔝"],"ribbon":["💝","🎀","🎗️"],"sparkle":["💖","❇️"],"grow":["💗"],"beat":["💓"],"revolve":["💞"],"two":["💕","🐫","🕑","🕝"],"decoration":["💟","🎍"],"exclamation":["❣️","‼️","⁉️","❕","❗"],"broken":["💔"],"fire":["❤️‍🔥","🚒","🔥","🧯"],"mend":["❤️‍🩹"],"red":["❤️","👨‍🦰","👩‍🦰","🧑‍🦰","🍎","🧧","🀄","🏮","❓","❗","⭕","🔴","🟥","🔺","🔻"],"pink":["🩷"],"orange":["🧡","📙","🟠","🟧","🔶","🔸"],"yellow":["💛","🟡","🟨"],"green":["💚","🍏","🥬","🥗","📗","🟢","🟩"],"blue":["💙","🩵","📘","🔵","🟦","🔷","🔹"],"light":["🩵","🚈","🚨","🚥","🚦","💡"],"purple":["💜","🟣","🟪"],"brown":["🤎","🟤","🟫"],"black":["🖤","🐈‍⬛","🐦‍⬛","✒️","⚫","⬛","◼️","◾","▪️","🔲","🏴"],"grey":["🩶"],"white":["🤍","👨‍🦳","👩‍🦳","🧑‍🦳","🧑‍🦯","👨‍🦯","👩‍🦯","💮","🦯","❔","❕","⚪","⬜","◻️","◽","▫️","🔳","🏳️"],"mark":["💋","‼️","⁉️","❓","❔","❕","❗","✅","✔️","❌","❎","〽️","™️"],"hundred":["💯"],"points":["💯"],"anger":["💢","🗯️"],"symbol":["💢","♿","🚼","⚛️","☮️","⚧️","⚕️","♻️","🔰"],"collision":["💥"],"dizzy":["💫"],"droplets":["💦"],"dash":["💨","〰️"],"away":["💨"],"hole":["🕳️","⛳"],"speech":["💬","👁️‍🗨️","🗨️"],"balloon":["💬","💭","🎈"],"bubble":["👁️‍🗨️","🗨️","🗯️","🧋"],"left":["🗨️","👈","🤛","🔍","🛅","↙️","⬅️","↖️","↔️","↩️","↪️"],"right":["🗯️","👉","🤜","🔎","↗️","➡️","↘️","↔️","↩️","↪️","⤴️","⤵️"],"thought":["💭"],"zzz":["💤"],"wave":["👋","🌊"],"fingers":["🖐️","🤌","🤞"],"splayed":["🖐️"],"vulcan":["🖖"],"rightwards":["🫱","🫸"],"leftwards":["🫲","🫷"],"palm":["🫳","🫴","🌴"],"up":["🫴","👆","☝️","👍","🤲","📄","🗞️","⬆️","↗️","↖️","↕️","⤴️","⏫","🆙","🔺"],"push":["🫷","🫸"],"ok":["👌","🙆","🙆‍♂️","🙆‍♀️","🆗"],"pinched":["🤌"],"pinch":["🤏"],"victory":["✌️"],"index":["🫰","👈","👉","👆","👇","☝️","🫵","🗂️","📇"],"finger":["🫰","🖕"],"thumb":["🫰"],"you":["🤟"],"gesture":["🤟","🙅","🙅‍♂️","🙅‍♀️","🙆","🙆‍♂️","🙆‍♀️"],"sign":["🤘","🛑","🏧","🚮","♀️","♂️","🟰","💲"],"call":["🤙"],"me":["🤙"],"backhand":["👈","👉","👆","👇"],"point":["👈","👉","👆","👇","☝️","🫵"],"middle":["🖕"],"at":["🫵","🌆","🌉"],"viewer":["🫵"],"thumbs":["👍","👎"],"fist":["✊","👊","🤛","🤜"],"oncome":["👊","🚍","🚔","🚖","🚘"],"clap":["👏"],"raise":["🙌","🙋","🙋‍♂️","🙋‍♀️"],"palms":["🤲"],"together":["🤲"],"handshake":["🤝"],"folded":["🙏"],"write":["✍️"],"nail":["💅"],"polish":["💅"],"selfie":["🤳"],"flexed":["💪"],"biceps":["💪"],"mechanical":["🦾","🦿"],"arm":["🦾"],"leg":["🦿","🦵","🍗"],"foot":["🦶"],"ear":["👂","🦻","🌽"],"aid":["🦻"],"brain":["🧠"],"anatomical":["🫀"],"lungs":["🫁"],"tooth":["🦷"],"bone":["🦴","🍖"],"bite":["🫦"],"lip":["🫦"],"baby":["👶","👩‍🍼","👨‍🍼","🧑‍🍼","👼","🐤","🐥","🍼","🚼"],"child":["🧒"],"boy":["👦","👨‍👩‍👦","👨‍👩‍👧‍👦","👨‍👩‍👦‍👦","👨‍👨‍👦","👨‍👨‍👧‍👦","👨‍👨‍👦‍👦","👩‍👩‍👦","👩‍👩‍👧‍👦","👩‍👩‍👦‍👦","👨‍👦","👨‍👦‍👦","👨‍👧‍👦","👩‍👦","👩‍👦‍👦","👩‍👧‍👦"],"girl":["👧","👨‍👩‍👧","👨‍👩‍👧‍👦","👨‍👩‍👧‍👧","👨‍👨‍👧","👨‍👨‍👧‍👦","👨‍👨‍👧‍👧","👩‍👩‍👧","👩‍👩‍👧‍👦","👩‍👩‍👧‍👧","👨‍👧","👨‍👧‍👦","👨‍👧‍👧","👩‍👧","👩‍👧‍👦","👩‍👧‍👧"],"person":["🧑","👱","🧔","🧑‍🦰","🧑‍🦱","🧑‍🦳","🧑‍🦲","🧓","🙍","🙎","🙅","🙆","💁","🙋","🧏","🙇","🤦","🤷","🫅","👳","👲","🤵","👰","🫄","🧑‍🍼","💆","💇","🚶","🧍","🧎","🧑‍🦯","🧑‍🦼","🧑‍🦽","🏃","🕴️","🧖","🧗","🤺","🏌️","🏄","🚣","🏊","⛹️","🏋️","🚴","🚵","🤸","🤽","🤾","🤹","🧘","🛀","🛌"],"blond":["👱","👱‍♀️","👱‍♂️"],"hair":["👱","👨‍🦰","👨‍🦱","👨‍🦳","👩‍🦰","🧑‍🦰","👩‍🦱","🧑‍🦱","👩‍🦳","🧑‍🦳","👱‍♀️","👱‍♂️","🪮"],"man":["👨","🧔‍♂️","👨‍🦰","👨‍🦱","👨‍🦳","👨‍🦲","👱‍♂️","👴","🙍‍♂️","🙎‍♂️","🙅‍♂️","🙆‍♂️","💁‍♂️","🙋‍♂️","🧏‍♂️","🙇‍♂️","🤦‍♂️","🤷‍♂️","👨‍⚕️","👨‍🎓","👨‍🏫","👨‍⚖️","👨‍🌾","👨‍🍳","👨‍🔧","👨‍🏭","👨‍💼","👨‍🔬","👨‍💻","👨‍🎤","👨‍🎨","👨‍✈️","👨‍🚀","👨‍🚒","👮‍♂️","🕵️‍♂️","💂‍♂️","👷‍♂️","👳‍♂️","🤵‍♂️","👰‍♂️","🫃","👨‍🍼","🦸‍♂️","🦹‍♂️","🧙‍♂️","🧚‍♂️","🧛‍♂️","🧝‍♂️","🧞‍♂️","🧟‍♂️","💆‍♂️","💇‍♂️","🚶‍♂️","🧍‍♂️","🧎‍♂️","👨‍🦯","👨‍🦼","👨‍🦽","🏃‍♂️","🕺","🧖‍♂️","🧗‍♂️","🏌️‍♂️","🏄‍♂️","🚣‍♂️","🏊‍♂️","⛹️‍♂️","🏋️‍♂️","🚴‍♂️","🚵‍♂️","🤸‍♂️","🤽‍♂️","🤾‍♂️","🤹‍♂️","🧘‍♂️","👫","👩‍❤️‍💋‍👨","👨‍❤️‍💋‍👨","👩‍❤️‍👨","👨‍❤️‍👨","👨‍👩‍👦","👨‍👩‍👧","👨‍👩‍👧‍👦","👨‍👩‍👦‍👦","👨‍👩‍👧‍👧","👨‍👨‍👦","👨‍👨‍👧","👨‍👨‍👧‍👦","👨‍👨‍👦‍👦","👨‍👨‍👧‍👧","👨‍👦","👨‍👦‍👦","👨‍👧","👨‍👧‍👦","👨‍👧‍👧","👞","🇮🇲"],"beard":["🧔","🧔‍♂️","🧔‍♀️"],"woman":["🧔‍♀️","👩","👩‍🦰","👩‍🦱","👩‍🦳","👩‍🦲","👱‍♀️","👵","🙍‍♀️","🙎‍♀️","🙅‍♀️","🙆‍♀️","💁‍♀️","🙋‍♀️","🧏‍♀️","🙇‍♀️","🤦‍♀️","🤷‍♀️","👩‍⚕️","👩‍🎓","👩‍🏫","👩‍⚖️","👩‍🌾","👩‍🍳","👩‍🔧","👩‍🏭","👩‍💼","👩‍🔬","👩‍💻","👩‍🎤","👩‍🎨","👩‍✈️","👩‍🚀","👩‍🚒","👮‍♀️","🕵️‍♀️","💂‍♀️","👷‍♀️","👳‍♀️","🧕","🤵‍♀️","👰‍♀️","🤰","👩‍🍼","🦸‍♀️","🦹‍♀️","🧙‍♀️","🧚‍♀️","🧛‍♀️","🧝‍♀️","🧞‍♀️","🧟‍♀️","💆‍♀️","💇‍♀️","🚶‍♀️","🧍‍♀️","🧎‍♀️","👩‍🦯","👩‍🦼","👩‍🦽","🏃‍♀️","💃","🧖‍♀️","🧗‍♀️","🏌️‍♀️","🏄‍♀️","🚣‍♀️","🏊‍♀️","⛹️‍♀️","🏋️‍♀️","🚴‍♀️","🚵‍♀️","🤸‍♀️","🤽‍♀️","🤾‍♀️","🤹‍♀️","🧘‍♀️","👫","👩‍❤️‍💋‍👨","👩‍❤️‍💋‍👩","👩‍❤️‍👨","👩‍❤️‍👩","👨‍👩‍👦","👨‍👩‍👧","👨‍👩‍👧‍👦","👨‍👩‍👦‍👦","👨‍👩‍👧‍👧","👩‍👩‍👦","👩‍👩‍👧","👩‍👩‍👧‍👦","👩‍👩‍👦‍👦","👩‍👩‍👧‍👧","👩‍👦","👩‍👦‍👦","👩‍👧","👩‍👧‍👦","👩‍👧‍👧","👚","👡","👢","👒"],"curly":["👨‍🦱","👩‍🦱","🧑‍🦱","➰","➿"],"bald":["👨‍🦲","👩‍🦲","🧑‍🦲"],"older":["🧓"],"old":["👴","👵","🗝️"],"tip":["💁","💁‍♂️","💁‍♀️"],"deaf":["🧏","🧏‍♂️","🧏‍♀️"],"bow":["🙇","🙇‍♂️","🙇‍♀️","🏹"],"facepalm":["🤦","🤦‍♂️","🤦‍♀️"],"shrug":["🤷","🤷‍♂️","🤷‍♀️"],"health":["🧑‍⚕️","👨‍⚕️","👩‍⚕️"],"worker":["🧑‍⚕️","👨‍⚕️","👩‍⚕️","🧑‍🏭","👨‍🏭","👩‍🏭","🧑‍💼","👨‍💼","👩‍💼","👷","👷‍♂️","👷‍♀️","⛑️"],"student":["🧑‍🎓","👨‍🎓","👩‍🎓"],"teacher":["🧑‍🏫","👨‍🏫","👩‍🏫"],"judge":["🧑‍⚖️","👨‍⚖️","👩‍⚖️"],"farmer":["🧑‍🌾","👨‍🌾","👩‍🌾"],"cook":["🧑‍🍳","👨‍🍳","👩‍🍳","🍳","🇨🇰"],"mechanic":["🧑‍🔧","👨‍🔧","👩‍🔧"],"factory":["🧑‍🏭","👨‍🏭","👩‍🏭","🏭"],"office":["🧑‍💼","👨‍💼","👩‍💼","🏢","🏣","🏤"],"scientist":["🧑‍🔬","👨‍🔬","👩‍🔬"],"technologist":["🧑‍💻","👨‍💻","👩‍💻"],"singer":["🧑‍🎤","👨‍🎤","👩‍🎤"],"artist":["🧑‍🎨","👨‍🎨","👩‍🎨","🎨"],"pilot":["🧑‍✈️","👨‍✈️","👩‍✈️"],"astronaut":["🧑‍🚀","👨‍🚀","👩‍🚀"],"firefighter":["🧑‍🚒","👨‍🚒","👩‍🚒"],"police":["👮","👮‍♂️","👮‍♀️","🚓","🚔","🚨"],"officer":["👮","👮‍♂️","👮‍♀️"],"detective":["🕵️","🕵️‍♂️","🕵️‍♀️"],"guard":["💂","💂‍♂️","💂‍♀️"],"ninja":["🥷"],"construction":["👷","👷‍♂️","👷‍♀️","🏗️","🚧"],"crown":["🫅","👑"],"prince":["🤴"],"princess":["👸"],"wear":["👳","👳‍♂️","👳‍♀️"],"turban":["👳","👳‍♂️","👳‍♀️"],"skullcap":["👲"],"headscarf":["🧕"],"tuxedo":["🤵","🤵‍♂️","🤵‍♀️"],"veil":["👰","👰‍♂️","👰‍♀️"],"pregnant":["🤰","🫃","🫄"],"breast":["🤱"],"feed":["🤱","👩‍🍼","👨‍🍼","🧑‍🍼"],"angel":["👼"],"santa":["🎅"],"claus":["🎅","🤶","🧑‍🎄"],"mrs":["🤶"],"mx":["🧑‍🎄"],"superhero":["🦸","🦸‍♂️","🦸‍♀️"],"supervillain":["🦹","🦹‍♂️","🦹‍♀️"],"mage":["🧙","🧙‍♂️","🧙‍♀️"],"fairy":["🧚","🧚‍♂️","🧚‍♀️"],"vampire":["🧛","🧛‍♂️","🧛‍♀️"],"merperson":["🧜"],"merman":["🧜‍♂️"],"mermaid":["🧜‍♀️"],"elf":["🧝","🧝‍♂️","🧝‍♀️"],"genie":["🧞","🧞‍♂️","🧞‍♀️"],"zombie":["🧟","🧟‍♂️","🧟‍♀️"],"troll":["🧌"],"gett":["💆","💆‍♂️","💆‍♀️","💇","💇‍♂️","💇‍♀️"],"massage":["💆","💆‍♂️","💆‍♀️"],"haircut":["💇","💇‍♂️","💇‍♀️"],"walk":["🚶","🚶‍♂️","🚶‍♀️"],"stand":["🧍","🧍‍♂️","🧍‍♀️"],"kneel":["🧎","🧎‍♂️","🧎‍♀️"],"cane":["🧑‍🦯","👨‍🦯","👩‍🦯","🦯"],"motorized":["🧑‍🦼","👨‍🦼","👩‍🦼","🦼"],"wheelchair":["🧑‍🦼","👨‍🦼","👩‍🦼","🧑‍🦽","👨‍🦽","👩‍🦽","🦽","🦼","♿"],"manual":["🧑‍🦽","👨‍🦽","👩‍🦽","🦽"],"run":["🏃","🏃‍♂️","🏃‍♀️","🎽","👟"],"dance":["💃","🕺"],"suit":["🕴️","♠️","♥️","♦️","♣️"],"levitate":["🕴️"],"people":["👯","🤼","🧑‍🤝‍🧑","🫂"],"bunny":["👯","👯‍♂️","👯‍♀️"],"ears":["👯","👯‍♂️","👯‍♀️"],"men":["👯‍♂️","🤼‍♂️","👬","🚹"],"women":["👯‍♀️","🤼‍♀️","👭","🚺"],"steamy":["🧖","🧖‍♂️","🧖‍♀️"],"room":["🧖","🧖‍♂️","🧖‍♀️","🚹","🚺"],"climb":["🧗","🧗‍♂️","🧗‍♀️"],"fence":["🤺"],"horse":["🏇","🐴","🐎","🎠"],"race":["🏇","🏎️"],"skier":["⛷️"],"snowboarder":["🏂"],"golf":["🏌️","🏌️‍♂️","🏌️‍♀️"],"surf":["🏄","🏄‍♂️","🏄‍♀️"],"row":["🚣","🚣‍♂️","🚣‍♀️"],"boat":["🚣","🚣‍♂️","🚣‍♀️","🛥️"],"swim":["🏊","🏊‍♂️","🏊‍♀️"],"bounce":["⛹️","⛹️‍♂️","⛹️‍♀️"],"ball":["⛹️","⛹️‍♂️","⛹️‍♀️","🍙","🎊","⚽","🎱","🔮","🪩"],"lift":["🏋️","🏋️‍♂️","🏋️‍♀️"],"weights":["🏋️","🏋️‍♂️","🏋️‍♀️"],"bike":["🚴","🚴‍♂️","🚴‍♀️","🚵","🚵‍♂️","🚵‍♀️"],"mountain":["🚵","🚵‍♂️","🚵‍♀️","🏔️","⛰️","🚞","🚠"],"cartwheel":["🤸","🤸‍♂️","🤸‍♀️"],"wrestle":["🤼","🤼‍♂️","🤼‍♀️"],"play":["🤽","🤽‍♂️","🤽‍♀️","🤾","🤾‍♂️","🤾‍♀️","🎴","▶️","⏯️"],"water":["🤽","🤽‍♂️","🤽‍♀️","🐃","🌊","🔫","🚰","🚾","🚱"],"polo":["🤽","🤽‍♂️","🤽‍♀️"],"handball":["🤾","🤾‍♂️","🤾‍♀️"],"juggle":["🤹","🤹‍♂️","🤹‍♀️"],"lotus":["🧘","🧘‍♂️","🧘‍♀️","🪷"],"position":["🧘","🧘‍♂️","🧘‍♀️"],"take":["🛀"],"bath":["🛀"],"bed":["🛌","🛏️"],"couple":["💑","👩‍❤️‍👨","👨‍❤️‍👨","👩‍❤️‍👩"],"family":["👪","👨‍👩‍👦","👨‍👩‍👧","👨‍👩‍👧‍👦","👨‍👩‍👦‍👦","👨‍👩‍👧‍👧","👨‍👨‍👦","👨‍👨‍👧","👨‍👨‍👧‍👦","👨‍👨‍👦‍👦","👨‍👨‍👧‍👧","👩‍👩‍👦","👩‍👩‍👧","👩‍👩‍👧‍👦","👩‍👩‍👦‍👦","👩‍👩‍👧‍👧","👨‍👦","👨‍👦‍👦","👨‍👧","👨‍👧‍👦","👨‍👧‍👧","👩‍👦","👩‍👦‍👦","👩‍👧","👩‍👧‍👦","👩‍👧‍👧"],"bust":["👤"],"silhouette":["👤","👥"],"busts":["👥"],"hug":["🫂"],"footprints":["👣"],"gorilla":["🦍"],"orangutan":["🦧"],"dog":["🐶","🐕","🦮","🐕‍🦺","🌭"],"guide":["🦮"],"service":["🐕‍🦺","🈂️"],"poodle":["🐩"],"wolf":["🐺"],"fox":["🦊"],"raccoon":["🦝"],"lion":["🦁"],"tiger":["🐯","🐅"],"leopard":["🐆"],"moose":["🫎"],"donkey":["🫏"],"unicorn":["🦄"],"zebra":["🦓"],"deer":["🦌"],"bison":["🦬"],"cow":["🐮","🐄"],"ox":["🐂"],"buffalo":["🐃"],"pig":["🐷","🐖","🐽"],"boar":["🐗"],"ram":["🐏"],"ewe":["🐑"],"goat":["🐐"],"camel":["🐪","🐫"],"hump":["🐫"],"llama":["🦙"],"giraffe":["🦒"],"elephant":["🐘"],"mammoth":["🦣"],"rhinoceros":["🦏"],"hippopotamus":["🦛"],"mouse":["🐭","🐁","🖱️","🪤"],"rat":["🐀"],"hamster":["🐹"],"rabbit":["🐰","🐇"],"chipmunk":["🐿️"],"beaver":["🦫"],"hedgehog":["🦔"],"bat":["🦇"],"bear":["🐻","🐻‍❄️","🧸"],"polar":["🐻‍❄️"],"koala":["🐨"],"panda":["🐼"],"sloth":["🦥"],"otter":["🦦"],"skunk":["🦨"],"kangaroo":["🦘"],"badger":["🦡"],"paw":["🐾"],"prints":["🐾"],"turkey":["🦃","🇹🇷"],"chicken":["🐔"],"rooster":["🐓"],"hatch":["🐣"],"chick":["🐣","🐤","🐥"],"front":["🐥"],"bird":["🐦","🐦‍⬛"],"penguin":["🐧"],"dove":["🕊️"],"eagle":["🦅"],"duck":["🦆"],"swan":["🦢"],"owl":["🦉"],"dodo":["🦤"],"feather":["🪶"],"flamingo":["🦩"],"peacock":["🦚"],"parrot":["🦜"],"wing":["🪽"],"goose":["🪿"],"frog":["🐸"],"crocodile":["🐊"],"turtle":["🐢"],"lizard":["🦎"],"snake":["🐍"],"dragon":["🐲","🐉","🀄"],"sauropod":["🦕"],"rex":["🦖"],"spout":["🐳"],"whale":["🐳","🐋"],"dolphin":["🐬"],"seal":["🦭"],"fish":["🐟","🐠","🍥","🎣"],"tropical":["🐠","🍹"],"blowfish":["🐡"],"shark":["🦈"],"octopus":["🐙"],"shell":["🐚"],"coral":["🪸"],"jellyfish":["🪼"],"snail":["🐌"],"butterfly":["🦋"],"bug":["🐛"],"ant":["🐜"],"honeybee":["🐝"],"beetle":["🪲","🐞"],"lady":["🐞"],"cricket":["🦗","🏏"],"cockroach":["🪳"],"spider":["🕷️","🕸️"],"web":["🕸️"],"scorpion":["🦂"],"mosquito":["🦟"],"fly":["🪰","🛸","🥏"],"worm":["🪱"],"microbe":["🦠"],"bouquet":["💐"],"cherry":["🌸"],"blossom":["🌸","🌼"],"flower":["💮","🥀","🎴"],"rosette":["🏵️"],"rose":["🌹"],"wilted":["🥀"],"hibiscus":["🌺"],"sunflower":["🌻"],"tulip":["🌷"],"hyacinth":["🪻"],"seedle":["🌱"],"potted":["🪴"],"plant":["🪴"],"evergreen":["🌲"],"tree":["🌲","🌳","🌴","🎄","🎋"],"deciduous":["🌳"],"cactus":["🌵"],"sheaf":["🌾"],"rice":["🌾","🍘","🍙","🍚","🍛"],"herb":["🌿"],"shamrock":["☘️"],"four":["🍀","🕓","🕟"],"leaf":["🍀","🍁","🍂","🍃"],"clover":["🍀"],"maple":["🍁"],"fallen":["🍂"],"flutter":["🍃"],"wind":["🍃","🌬️","🎐"],"empty":["🪹"],"nest":["🪹","🪺","🪆"],"eggs":["🪺"],"mushroom":["🍄"],"grapes":["🍇"],"melon":["🍈"],"watermelon":["🍉"],"tangerine":["🍊"],"lemon":["🍋"],"banana":["🍌"],"pineapple":["🍍"],"mango":["🥭"],"apple":["🍎","🍏"],"pear":["🍐"],"peach":["🍑"],"cherries":["🍒"],"strawberry":["🍓"],"blueberries":["🫐"],"kiwi":["🥝"],"fruit":["🥝"],"tomato":["🍅"],"olive":["🫒"],"coconut":["🥥"],"avocado":["🥑"],"eggplant":["🍆"],"potato":["🥔","🍠"],"carrot":["🥕"],"corn":["🌽"],"pepper":["🌶️","🫑"],"bell":["🫑","🛎️","🔔","🔕"],"cucumber":["🥒"],"leafy":["🥬"],"broccoli":["🥦"],"garlic":["🧄"],"onion":["🧅"],"peanuts":["🥜"],"beans":["🫘"],"chestnut":["🌰"],"ginger":["🫚"],"root":["🫚"],"pea":["🫛"],"pod":["🫛"],"bread":["🍞","🥖"],"croissant":["🥐"],"baguette":["🥖"],"flatbread":["🫓","🥙"],"pretzel":["🥨"],"bagel":["🥯"],"pancakes":["🥞"],"waffle":["🧇"],"cheese":["🧀"],"wedge":["🧀"],"meat":["🍖","🥩"],"poultry":["🍗"],"cut":["🥩"],"bacon":["🥓"],"hamburger":["🍔"],"french":["🍟","🇬🇫","🇵🇫","🇹🇫"],"fries":["🍟"],"pizza":["🍕"],"sandwich":["🥪","🇬🇸"],"taco":["🌮"],"burrito":["🌯"],"tamale":["🫔"],"stuffed":["🥙"],"falafel":["🧆"],"egg":["🥚"],"shallow":["🥘"],"pan":["🥘"],"pot":["🍲","🍯"],"fondue":["🫕"],"bowl":["🥣","🍜","🎳"],"spoon":["🥣","🥄"],"salad":["🥗"],"popcorn":["🍿"],"butter":["🧈"],"salt":["🧂"],"canned":["🥫"],"bento":["🍱"],"box":["🍱","🥡","🧃","🥊","🗳️","🗃️","☑️"],"cracker":["🍘"],"cooked":["🍚"],"curry":["🍛"],"spaghetti":["🍝"],"roasted":["🍠"],"sweet":["🍠"],"oden":["🍢"],"sushi":["🍣"],"fried":["🍤"],"shrimp":["🍤","🦐"],"cake":["🍥","🥮","🎂"],"swirl":["🍥"],"moon":["🥮","🌑","🌒","🌓","🌔","🌕","🌖","🌗","🌘","🌙","🌚","🌛","🌜","🌝","🎑"],"dango":["🍡"],"dumple":["🥟"],"fortune":["🥠"],"cookie":["🥠","🍪"],"takeout":["🥡"],"crab":["🦀"],"lobster":["🦞"],"squid":["🦑"],"oyster":["🦪"],"soft":["🍦"],"ice":["🍦","🍧","🍨","🧊","🏒","⛸️"],"cream":["🍦","🍨"],"shaved":["🍧"],"doughnut":["🍩"],"birthday":["🎂"],"shortcake":["🍰"],"cupcake":["🧁"],"pie":["🥧"],"chocolate":["🍫"],"bar":["🍫","📊"],"candy":["🍬"],"lollipop":["🍭"],"custard":["🍮"],"honey":["🍯"],"bottle":["🍼","🍾","🧴"],"glass":["🥛","🍷","🍸","🥃","🔍","🔎"],"milk":["🥛"],"beverage":["☕","🧃"],"teapot":["🫖"],"teacup":["🍵"],"handle":["🍵"],"sake":["🍶"],"pop":["🍾"],"cork":["🍾"],"wine":["🍷"],"cocktail":["🍸"],"drink":["🍹"],"beer":["🍺","🍻"],"mug":["🍺"],"clink":["🍻","🥂"],"mugs":["🍻"],"glasses":["🥂","👓"],"tumbler":["🥃"],"pour":["🫗"],"liquid":["🫗"],"cup":["🥤"],"straw":["🥤"],"tea":["🧋"],"mate":["🧉"],"chopsticks":["🥢"],"fork":["🍽️","🍴"],"knife":["🍽️","🍴","🔪"],"plate":["🍽️"],"kitchen":["🔪"],"jar":["🫙"],"amphora":["🏺"],"globe":["🌍","🌎","🌏","🌐"],"show":["🌍","🌎","🌏"],"europe":["🌍"],"africa":["🌍","🇿🇦"],"americas":["🌎"],"asia":["🌏"],"australia":["🌏","🇦🇺"],"meridians":["🌐"],"world":["🗺️"],"map":["🗺️","🗾"],"japan":["🗾","🇯🇵"],"compass":["🧭"],"snow":["🏔️","🌨️","⛄"],"capped":["🏔️"],"volcano":["🌋"],"mount":["🗻"],"fuji":["🗻"],"camp":["🏕️"],"beach":["🏖️"],"umbrella":["🏖️","🌂","☂️","☔","⛱️"],"desert":["🏜️","🏝️"],"island":["🏝️","🇦🇨","🇧🇻","🇨🇵","🇨🇽","🇳🇫"],"national":["🏞️"],"park":["🏞️"],"stadium":["🏟️"],"classical":["🏛️"],"build":["🏛️","🏗️","🏢"],"brick":["🧱"],"rock":["🪨"],"wood":["🪵"],"hut":["🛖"],"houses":["🏘️"],"derelict":["🏚️"],"house":["🏚️","🏠","🏡"],"garden":["🏡"],"japanese":["🏣","🏯","🎎","🔰","🈁","🈂️","🈷️","🈶","🈯","🉐","🈹","🈚","🈲","🉑","🈸","🈴","🈳","㊗️","㊙️","🈺","🈵"],"post":["🏣","🏤"],"hospital":["🏥"],"bank":["🏦"],"hotel":["🏨","🏩"],"convenience":["🏪"],"store":["🏪","🏬"],"school":["🏫"],"department":["🏬"],"castle":["🏯","🏰"],"wed":["💒"],"tokyo":["🗼"],"tower":["🗼"],"statue":["🗽"],"liberty":["🗽"],"church":["⛪"],"mosque":["🕌"],"hindu":["🛕"],"temple":["🛕"],"synagogue":["🕍"],"shinto":["⛩️"],"shrine":["⛩️"],"kaaba":["🕋"],"fountain":["⛲","🖋️"],"tent":["⛺","🎪"],"foggy":["🌁"],"night":["🌃","🌉"],"stars":["🌃"],"cityscape":["🏙️","🌆"],"sunrise":["🌄","🌅"],"mountains":["🌄"],"dusk":["🌆"],"sunset":["🌇"],"bridge":["🌉"],"springs":["♨️"],"carousel":["🎠"],"playground":["🛝"],"slide":["🛝"],"ferris":["🎡"],"wheel":["🎡","🛞","☸️"],"roller":["🎢","🛼"],"coaster":["🎢"],"barber":["💈"],"pole":["💈","🎣"],"circus":["🎪"],"locomotive":["🚂"],"railway":["🚃","🚞","🛤️","🚟"],"car":["🚃","🚋","🚓","🚔","🏎️","🚨"],"high":["🚄","⚡","👠","🔊"],"speed":["🚄"],"train":["🚄","🚅","🚆"],"bullet":["🚅"],"metro":["🚇"],"rail":["🚈"],"station":["🚉"],"tram":["🚊","🚋"],"monorail":["🚝"],"bus":["🚌","🚍","🚏"],"trolleybus":["🚎"],"minibus":["🚐"],"ambulance":["🚑"],"engine":["🚒"],"taxi":["🚕","🚖"],"automobile":["🚗","🚘"],"sport":["🚙"],"utility":["🚙"],"vehicle":["🚙"],"pickup":["🛻"],"truck":["🛻","🚚"],"delivery":["🚚"],"articulated":["🚛"],"lorry":["🚛"],"tractor":["🚜"],"motorcycle":["🏍️"],"motor":["🛵","🛥️"],"scooter":["🛵","🛴"],"auto":["🛺"],"rickshaw":["🛺"],"bicycle":["🚲"],"kick":["🛴"],"skateboard":["🛹"],"skate":["🛼","⛸️"],"stop":["🚏","🛑","⏹️"],"motorway":["🛣️"],"track":["🛤️","⏭️","⏮️"],"oil":["🛢️"],"drum":["🛢️","🥁","🪘"],"fuel":["⛽"],"pump":["⛽"],"horizontal":["🚥"],"traffic":["🚥","🚦"],"vertical":["🚦","🔃"],"anchor":["⚓"],"ring":["🛟","💍"],"buoy":["🛟"],"sailboat":["⛵"],"canoe":["🛶"],"speedboat":["🚤"],"passenger":["🛳️"],"ship":["🛳️","🚢"],"ferry":["⛴️"],"airplane":["✈️","🛩️","🛫","🛬"],"small":["🛩️","🌤️","◾","◽","▪️","▫️","🔸","🔹"],"departure":["🛫"],"arrival":["🛬"],"parachute":["🪂"],"seat":["💺"],"helicopter":["🚁"],"suspension":["🚟"],"cableway":["🚠"],"aerial":["🚡"],"tramway":["🚡"],"satellite":["🛰️","📡"],"rocket":["🚀"],"saucer":["🛸"],"bellhop":["🛎️"],"luggage":["🧳","🛅"],"hourglass":["⌛","⏳"],"done":["⌛","⏳"],"not":["⏳","🈶"],"watch":["⌚"],"alarm":["⏰"],"clock":["⏰","⏲️","🕰️","🕛","🕐","🕑","🕒","🕓","🕔","🕕","🕖","🕗","🕘","🕙","🕚"],"stopwatch":["⏱️"],"timer":["⏲️"],"mantelpiece":["🕰️"],"twelve":["🕛","🕧"],"thirty":["🕧","🕜","🕝","🕞","🕟","🕠","🕡","🕢","🕣","🕤","🕥","🕦"],"one":["🕐","🕜","🩱","🔞"],"three":["🕒","🕞"],"five":["🕔","🕠"],"six":["🕕","🕡","🔯"],"seven":["🕖","🕢"],"eight":["🕗","🕣","✳️","✴️"],"nine":["🕘","🕤"],"ten":["🕙","🕥"],"eleven":["🕚","🕦"],"new":["🌑","🌚","🆕","🇳🇨","🇳🇿","🇵🇬"],"wax":["🌒","🌔"],"crescent":["🌒","🌘","🌙","☪️"],"first":["🌓","🌛"],"quarter":["🌓","🌗","🌛","🌜"],"gibbous":["🌔","🌖"],"full":["🌕","🌝"],"wane":["🌖","🌘"],"last":["🌗","🌜","⏮️"],"sun":["☀️","🌞","⛅","🌤️","🌥️","🌦️"],"ringed":["🪐"],"planet":["🪐"],"glow":["🌟"],"shoot":["🌠"],"milky":["🌌"],"way":["🌌"],"cloud":["☁️","⛅","⛈️","🌤️","🌥️","🌦️","🌧️","🌨️","🌩️"],"behind":["⛅","🌤️","🌥️","🌦️"],"lightning":["⛈️","🌩️"],"rain":["⛈️","🌦️","🌧️","☔"],"large":["🌥️","⬛","⬜","🔶","🔷"],"tornado":["🌪️"],"fog":["🌫️"],"cyclone":["🌀"],"rainbow":["🌈","🏳️‍🌈"],"drops":["☔"],"ground":["⛱️"],"voltage":["⚡"],"snowflake":["❄️"],"snowman":["☃️","⛄"],"comet":["☄️"],"droplet":["💧"],"jack":["🎃"],"lantern":["🎃","🏮"],"christmas":["🎄","🇨🇽"],"fireworks":["🎆"],"sparkler":["🎇"],"firecracker":["🧨"],"sparkles":["✨"],"popper":["🎉"],"confetti":["🎊"],"tanabata":["🎋"],"pine":["🎍"],"dolls":["🎎","🪆"],"carp":["🎏"],"streamer":["🎏"],"chime":["🎐"],"view":["🎑"],"ceremony":["🎑"],"envelope":["🧧","✉️","📨","📩"],"wrapped":["🎁"],"gift":["🎁"],"reminder":["🎗️"],"admission":["🎟️"],"tickets":["🎟️"],"ticket":["🎫"],"military":["🎖️","🪖"],"medal":["🎖️","🏅","🥇","🥈","🥉"],"trophy":["🏆"],"sports":["🏅"],"1st":["🥇"],"place":["🥇","🥈","🥉","🛐"],"2nd":["🥈"],"3rd":["🥉"],"soccer":["⚽"],"baseball":["⚾"],"softball":["🥎"],"basketball":["🏀"],"volleyball":["🏐"],"american":["🏈","🇦🇸"],"football":["🏈","🏉"],"rugby":["🏉"],"tennis":["🎾"],"disc":["🥏"],"game":["🏏","🎮","🎲"],"field":["🏑"],"hockey":["🏑","🏒"],"lacrosse":["🥍"],"ping":["🏓"],"pong":["🏓"],"badminton":["🏸"],"glove":["🥊"],"martial":["🥋"],"arts":["🥋","🎭"],"uniform":["🥋"],"goal":["🥅"],"net":["🥅"],"flag":["⛳","📫","📪","📬","📭","🏁","🚩","🏴","🏳️","🏳️‍🌈","🏳️‍⚧️","🏴‍☠️","🇦🇨","🇦🇩","🇦🇪","🇦🇫","🇦🇬","🇦🇮","🇦🇱","🇦🇲","🇦🇴","🇦🇶","🇦🇷","🇦🇸","🇦🇹","🇦🇺","🇦🇼","🇦🇽","🇦🇿","🇧🇦","🇧🇧","🇧🇩","🇧🇪","🇧🇫","🇧🇬","🇧🇭","🇧🇮","🇧🇯","🇧🇱","🇧🇲","🇧🇳","🇧🇴","🇧🇶","🇧🇷","🇧🇸","🇧🇹","🇧🇻","🇧🇼","🇧🇾","🇧🇿","🇨🇦","🇨🇨","🇨🇩","🇨🇫","🇨🇬","🇨🇭","🇨🇮","🇨🇰","🇨🇱","🇨🇲","🇨🇳","🇨🇴","🇨🇵","🇨🇷","🇨🇺","🇨🇻","🇨🇼","🇨🇽","🇨🇾","🇨🇿","🇩🇪","🇩🇬","🇩🇯","🇩🇰","🇩🇲","🇩🇴","🇩🇿","🇪🇦","🇪🇨","🇪🇪","🇪🇬","🇪🇭","🇪🇷","🇪🇸","🇪🇹","🇪🇺","🇫🇮","🇫🇯","🇫🇰","🇫🇲","🇫🇴","🇫🇷","🇬🇦","🇬🇧","🇬🇩","🇬🇪","🇬🇫","🇬🇬","🇬🇭","🇬🇮","🇬🇱","🇬🇲","🇬🇳","🇬🇵","🇬🇶","🇬🇷","🇬🇸","🇬🇹","🇬🇺","🇬🇼","🇬🇾","🇭🇰","🇭🇲","🇭🇳","🇭🇷","🇭🇹","🇭🇺","🇮🇨","🇮🇩","🇮🇪","🇮🇱","🇮🇲","🇮🇳","🇮🇴","🇮🇶","🇮🇷","🇮🇸","🇮🇹","🇯🇪","🇯🇲","🇯🇴","🇯🇵","🇰🇪","🇰🇬","🇰🇭","🇰🇮","🇰🇲","🇰🇳","🇰🇵","🇰🇷","🇰🇼","🇰🇾","🇰🇿","🇱🇦","🇱🇧","🇱🇨","🇱🇮","🇱🇰","🇱🇷","🇱🇸","🇱🇹","🇱🇺","🇱🇻","🇱🇾","🇲🇦","🇲🇨","🇲🇩","🇲🇪","🇲🇫","🇲🇬","🇲🇭","🇲🇰","🇲🇱","🇲🇲","🇲🇳","🇲🇴","🇲🇵","🇲🇶","🇲🇷","🇲🇸","🇲🇹","🇲🇺","🇲🇻","🇲🇼","🇲🇽","🇲🇾","🇲🇿","🇳🇦","🇳🇨","🇳🇪","🇳🇫","🇳🇬","🇳🇮","🇳🇱","🇳🇴","🇳🇵","🇳🇷","🇳🇺","🇳🇿","🇴🇲","🇵🇦","🇵🇪","🇵🇫","🇵🇬","🇵🇭","🇵🇰","🇵🇱","🇵🇲","🇵🇳","🇵🇷","🇵🇸","🇵🇹","🇵🇼","🇵🇾","🇶🇦","🇷🇪","🇷🇴","🇷🇸","🇷🇺","🇷🇼","🇸🇦","🇸🇧","🇸🇨","🇸🇩","🇸🇪","🇸🇬","🇸🇭","🇸🇮","🇸🇯","🇸🇰","🇸🇱","🇸🇲","🇸🇳","🇸🇴","🇸🇷","🇸🇸","🇸🇹","🇸🇻","🇸🇽","🇸🇾","🇸🇿","🇹🇦","🇹🇨","🇹🇩","🇹🇫","🇹🇬","🇹🇭","🇹🇯","🇹🇰","🇹🇱","🇹🇲","🇹🇳","🇹🇴","🇹🇷","🇹🇹","🇹🇻","🇹🇼","🇹🇿","🇺🇦","🇺🇬","🇺🇲","🇺🇳","🇺🇸","🇺🇾","🇺🇿","🇻🇦","🇻🇨","🇻🇪","🇻🇬","🇻🇮","🇻🇳","🇻🇺","🇼🇫","🇼🇸","🇽🇰","🇾🇪","🇾🇹","🇿🇦","🇿🇲","🇿🇼","🏴󠁧󠁢󠁥󠁮󠁧󠁿","🏴󠁧󠁢󠁳󠁣󠁴󠁿","🏴󠁧󠁢󠁷󠁬󠁳󠁿"],"dive":["🤿"],"shirt":["🎽","👕"],"skis":["🎿"],"sled":["🛷"],"curl":["🥌","📃"],"stone":["🥌","💎"],"bullseye":["🎯"],"yo":["🪀"],"kite":["🪁"],"pistol":["🔫"],"pool":["🎱"],"crystal":["🔮"],"magic":["🪄"],"wand":["🪄"],"video":["🎮","📹"],"joystick":["🕹️"],"slot":["🎰"],"machine":["🎰","📠"],"die":["🎲"],"puzzle":["🧩"],"piece":["🧩","🩱"],"teddy":["🧸"],"pinata":["🪅"],"mirror":["🪩","🪞"],"spade":["♠️"],"diamond":["♦️","🔶","🔷","🔸","🔹","💠"],"club":["♣️"],"chess":["♟️"],"pawn":["♟️"],"joker":["🃏"],"mahjong":["🀄"],"cards":["🎴"],"perform":["🎭"],"framed":["🖼️"],"picture":["🖼️"],"palette":["🎨"],"thread":["🧵"],"sew":["🪡"],"needle":["🪡"],"yarn":["🧶"],"knot":["🪢"],"goggles":["🥽"],"lab":["🥼"],"coat":["🥼","🧥"],"safety":["🦺","🧷"],"vest":["🦺"],"necktie":["👔"],"jeans":["👖"],"scarf":["🧣"],"gloves":["🧤"],"socks":["🧦"],"dress":["👗"],"kimono":["👘"],"sari":["🥻"],"swimsuit":["🩱"],"briefs":["🩲"],"shorts":["🩳"],"bikini":["👙"],"clothes":["👚"],"fold":["🪭"],"fan":["🪭"],"purse":["👛"],"handbag":["👜"],"clutch":["👝"],"bag":["👝","💰"],"shop":["🛍️","🛒"],"bags":["🛍️"],"backpack":["🎒"],"thong":["🩴"],"sandal":["🩴","👡"],"shoe":["👞","👟","🥿","👠"],"hike":["🥾"],"boot":["🥾","👢"],"flat":["🥿"],"heeled":["👠"],"ballet":["🩰"],"shoes":["🩰"],"pick":["🪮","⛏️","⚒️"],"top":["🎩","🔝"],"graduation":["🎓"],"cap":["🎓","🧢"],"billed":["🧢"],"helmet":["🪖","⛑️"],"rescue":["⛑️"],"prayer":["📿"],"beads":["📿"],"lipstick":["💄"],"gem":["💎"],"muted":["🔇"],"speaker":["🔇","🔈","🔉","🔊"],"low":["🔈","🪫"],"volume":["🔈","🔉","🔊"],"medium":["🔉","◼️","◻️","◾","◽"],"loudspeaker":["📢"],"megaphone":["📣"],"postal":["📯"],"horn":["📯"],"slash":["🔕"],"musical":["🎼","🎵","🎶","🎹"],"score":["🎼"],"note":["🎵"],"notes":["🎶"],"studio":["🎙️"],"microphone":["🎙️","🎤"],"level":["🎚️"],"slider":["🎚️"],"control":["🎛️","🛂"],"knobs":["🎛️"],"headphone":["🎧"],"radio":["📻","🔘"],"saxophone":["🎷"],"accordion":["🪗"],"guitar":["🎸"],"keyboard":["🎹","⌨️"],"trumpet":["🎺"],"violin":["🎻"],"banjo":["🪕"],"long":["🪘"],"maracas":["🪇"],"flute":["🪈"],"mobile":["📱","📲","📵","📴"],"phone":["📱","📲","📴"],"telephone":["☎️","📞"],"receiver":["📞"],"pager":["📟"],"fax":["📠"],"battery":["🔋","🪫"],"electric":["🔌"],"plug":["🔌"],"laptop":["💻"],"desktop":["🖥️"],"computer":["🖥️","🖱️","💽"],"printer":["🖨️"],"trackball":["🖲️"],"disk":["💽","💾","💿"],"floppy":["💾"],"optical":["💿"],"dvd":["📀"],"abacus":["🧮"],"movie":["🎥"],"camera":["🎥","📷","📸","📹"],"film":["🎞️","📽️"],"frames":["🎞️"],"projector":["📽️"],"clapper":["🎬"],"board":["🎬"],"television":["📺"],"flash":["📸"],"videocassette":["📼"],"magnify":["🔍","🔎"],"tilted":["🔍","🔎"],"candle":["🕯️"],"bulb":["💡"],"flashlight":["🔦"],"paper":["🏮","🧻"],"diya":["🪔"],"lamp":["🪔","🛋️"],"notebook":["📔","📓"],"decorative":["📔"],"cover":["📔"],"book":["📕","📖","📗","📘","📙"],"books":["📚"],"ledger":["📒"],"page":["📃","📄"],"scroll":["📜"],"newspaper":["📰","🗞️"],"rolled":["🗞️"],"bookmark":["📑","🔖"],"tabs":["📑"],"label":["🏷️"],"coin":["🪙"],"yen":["💴","💹"],"banknote":["💴","💵","💶","💷"],"dollar":["💵","💲"],"euro":["💶"],"pound":["💷"],"wings":["💸"],"credit":["💳"],"card":["💳","🗂️","📇","🗃️","🪪"],"receipt":["🧾"],"chart":["💹","📈","📉","📊"],"increase":["💹","📈"],"mail":["📧"],"income":["📨"],"outbox":["📤"],"tray":["📤","📥"],"inbox":["📥"],"package":["📦"],"mailbox":["📫","📪","📬","📭"],"lowered":["📪","📭"],"postbox":["📮"],"ballot":["🗳️"],"pencil":["✏️"],"nib":["✒️"],"pen":["🖋️","🖊️","🔏"],"paintbrush":["🖌️"],"crayon":["🖍️"],"memo":["📝"],"briefcase":["💼"],"file":["📁","📂","🗃️","🗄️"],"folder":["📁","📂"],"dividers":["🗂️"],"calendar":["📅","📆","🗓️"],"off":["📆","📴"],"notepad":["🗒️"],"decrease":["📉"],"clipboard":["📋"],"pushpin":["📌","📍"],"round":["📍"],"paperclip":["📎"],"linked":["🖇️"],"paperclips":["🖇️"],"straight":["📏"],"ruler":["📏","📐"],"triangular":["📐","🚩"],"scissors":["✂️"],"cabinet":["🗄️"],"wastebasket":["🗑️"],"locked":["🔒","🔏","🔐"],"unlocked":["🔓"],"key":["🔐","🔑","🗝️"],"hammer":["🔨","⚒️","🛠️"],"axe":["🪓"],"wrench":["🛠️","🔧"],"dagger":["🗡️"],"swords":["⚔️"],"bomb":["💣"],"boomerang":["🪃"],"shield":["🛡️"],"carpentry":["🪚"],"saw":["🪚"],"screwdriver":["🪛"],"nut":["🔩"],"bolt":["🔩"],"gear":["⚙️"],"clamp":["🗜️"],"balance":["⚖️"],"scale":["⚖️"],"link":["🔗"],"chains":["⛓️"],"hook":["🪝"],"toolbox":["🧰"],"magnet":["🧲"],"ladder":["🪜"],"alembic":["⚗️"],"test":["🧪"],"tube":["🧪"],"petri":["🧫"],"dish":["🧫"],"dna":["🧬"],"microscope":["🔬"],"telescope":["🔭"],"antenna":["📡","📶"],"syringe":["💉"],"drop":["🩸"],"blood":["🩸","🅰️","🆎","🅱️","🅾️"],"pill":["💊"],"adhesive":["🩹"],"crutch":["🩼"],"stethoscope":["🩺"],"ray":["🩻"],"door":["🚪"],"elevator":["🛗"],"window":["🪟"],"couch":["🛋️"],"chair":["🪑"],"toilet":["🚽"],"plunger":["🪠"],"shower":["🚿"],"bathtub":["🛁"],"trap":["🪤"],"razor":["🪒"],"lotion":["🧴"],"pin":["🧷"],"broom":["🧹"],"basket":["🧺"],"bucket":["🪣"],"soap":["🧼"],"bubbles":["🫧"],"toothbrush":["🪥"],"sponge":["🧽"],"extinguisher":["🧯"],"cart":["🛒"],"cigarette":["🚬"],"coffin":["⚰️"],"headstone":["🪦"],"funeral":["⚱️"],"urn":["⚱️"],"nazar":["🧿"],"amulet":["🧿"],"hamsa":["🪬"],"moai":["🗿"],"placard":["🪧"],"identification":["🪪"],"atm":["🏧"],"litter":["🚮","🚯"],"bin":["🚮"],"potable":["🚰","🚱"],"restroom":["🚻"],"closet":["🚾"],"passport":["🛂"],"customs":["🛃"],"baggage":["🛄"],"claim":["🛄"],"warn":["⚠️"],"children":["🚸"],"cross":["🚸","✝️","☦️","❌","❎"],"entry":["⛔"],"prohibited":["🚫","🈲"],"bicycles":["🚳"],"smoke":["🚭"],"non":["🚱"],"pedestrians":["🚷"],"phones":["📵"],"under":["🔞"],"eighteen":["🔞"],"radioactive":["☢️"],"biohazard":["☣️"],"curve":["↩️","↪️","⤴️","⤵️"],"clockwise":["🔃"],"arrows":["🔃","🔄"],"counterclockwise":["🔄"],"button":["🔄","🔀","🔁","🔂","▶️","⏩","⏭️","⏯️","◀️","⏪","⏮️","🔼","⏫","🔽","⏬","⏸️","⏹️","⏺️","⏏️","🔅","🔆","✅","❎","🅰️","🆎","🅱️","🆑","🆒","🆓","🆔","🆕","🆖","🅾️","🆗","🅿️","🆘","🆙","🆚","🈁","🈂️","🈷️","🈶","🈯","🉐","🈹","🈚","🈲","🉑","🈸","🈴","🈳","㊗️","㊙️","🈺","🈵","🔘","🔳","🔲"],"end":["🔚"],"soon":["🔜"],"worship":["🛐"],"atom":["⚛️"],"om":["🕉️"],"david":["✡️"],"dharma":["☸️"],"yin":["☯️"],"yang":["☯️"],"latin":["✝️","🔠","🔡","🔤"],"orthodox":["☦️"],"peace":["☮️"],"menorah":["🕎"],"pointed":["🔯","✴️","🔺","🔻"],"khanda":["🪯"],"aries":["♈"],"taurus":["♉"],"gemini":["♊"],"cancer":["♋"],"leo":["♌"],"virgo":["♍"],"libra":["♎"],"scorpio":["♏"],"sagittarius":["♐"],"capricorn":["♑"],"aquarius":["♒"],"pisces":["♓"],"ophiuchus":["⛎"],"shuffle":["🔀"],"tracks":["🔀"],"repeat":["🔁","🔂"],"single":["🔂"],"fast":["⏩","⏪","⏫","⏬"],"forward":["⏩"],"next":["⏭️"],"or":["⏯️"],"pause":["⏯️","⏸️"],"reverse":["◀️","⏪"],"upwards":["🔼"],"downwards":["🔽"],"record":["⏺️"],"eject":["⏏️"],"cinema":["🎦"],"dim":["🔅"],"bright":["🔆"],"bars":["📶"],"wireless":["🛜"],"vibration":["📳"],"mode":["📳"],"female":["♀️"],"male":["♂️"],"transgender":["⚧️","🏳️‍⚧️"],"multiply":["✖️"],"plus":["➕"],"minus":["➖"],"divide":["➗"],"heavy":["🟰","💲"],"equals":["🟰"],"infinity":["♾️"],"double":["‼️","➿"],"question":["⁉️","❓","❔"],"wavy":["〰️"],"currency":["💱"],"exchange":["💱"],"recycle":["♻️"],"fleur":["⚜️"],"de":["⚜️"],"lis":["⚜️"],"trident":["🔱"],"emblem":["🔱"],"name":["📛"],"badge":["📛"],"for":["🔰","🈺"],"beginner":["🔰"],"hollow":["⭕"],"circle":["⭕","🔴","🟠","🟡","🟢","🔵","🟣","🟤","⚫","⚪"],"check":["✅","☑️","✔️"],"loop":["➰","➿"],"part":["〽️"],"alternation":["〽️"],"spoked":["✳️"],"asterisk":["✳️"],"copyright":["©️"],"registered":["®️"],"trade":["™️"],"keycap":["#️⃣","*️⃣","0️⃣","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"],"input":["🔠","🔡","🔢","🔣","🔤"],"uppercase":["🔠"],"lowercase":["🔡"],"numbers":["🔢"],"letters":["🔤"],"type":["🅰️","🆎","🅱️","🅾️"],"ab":["🆎"],"cl":["🆑"],"cool":["🆒"],"free":["🆓","🈶","🈚"],"information":["ℹ️"],"id":["🆔"],"circled":["Ⓜ️"],"ng":["🆖"],"sos":["🆘"],"vs":["🆚"],"here":["🈁"],"charge":["🈂️","🈶","🈚"],"monthly":["🈷️"],"amount":["🈷️"],"reserved":["🈯"],"bargain":["🉐"],"discount":["🈹"],"acceptable":["🉑"],"application":["🈸"],"pass":["🈴"],"grade":["🈴"],"vacancy":["🈳","🈵"],"congratulations":["㊗️"],"secret":["㊙️"],"business":["🈺"],"square":["🟥","🟧","🟨","🟩","🟦","🟪","🟫","⬛","⬜","◼️","◻️","◾","◽","▪️","▫️","🔳","🔲"],"triangle":["🔺","🔻"],"dot":["💠"],"chequered":["🏁"],"flags":["🎌"],"pirate":["🏴‍☠️"],"ascension":["🇦🇨"],"andorra":["🇦🇩"],"united":["🇦🇪","🇬🇧","🇺🇳","🇺🇸"],"arab":["🇦🇪"],"emirates":["🇦🇪"],"afghanistan":["🇦🇫"],"antigua":["🇦🇬"],"barbuda":["🇦🇬"],"anguilla":["🇦🇮"],"albania":["🇦🇱"],"armenia":["🇦🇲"],"angola":["🇦🇴"],"antarctica":["🇦🇶"],"argentina":["🇦🇷"],"samoa":["🇦🇸","🇼🇸"],"austria":["🇦🇹"],"aruba":["🇦🇼"],"aland":["🇦🇽"],"islands":["🇦🇽","🇨🇨","🇨🇰","🇫🇰","🇫🇴","🇬🇸","🇭🇲","🇮🇨","🇰🇾","🇲🇭","🇲🇵","🇵🇳","🇸🇧","🇹🇨","🇺🇲","🇻🇬","🇻🇮"],"azerbaijan":["🇦🇿"],"bosnia":["🇧🇦"],"herzegovina":["🇧🇦"],"barbados":["🇧🇧"],"bangladesh":["🇧🇩"],"belgium":["🇧🇪"],"burkina":["🇧🇫"],"faso":["🇧🇫"],"bulgaria":["🇧🇬"],"bahrain":["🇧🇭"],"burundi":["🇧🇮"],"benin":["🇧🇯"],"st":["🇧🇱","🇰🇳","🇱🇨","🇲🇫","🇵🇲","🇸🇭","🇻🇨"],"barthelemy":["🇧🇱"],"bermuda":["🇧🇲"],"brunei":["🇧🇳"],"bolivia":["🇧🇴"],"caribbean":["🇧🇶"],"netherlands":["🇧🇶","🇳🇱"],"brazil":["🇧🇷"],"bahamas":["🇧🇸"],"bhutan":["🇧🇹"],"bouvet":["🇧🇻"],"botswana":["🇧🇼"],"belarus":["🇧🇾"],"belize":["🇧🇿"],"canada":["🇨🇦"],"cocos":["🇨🇨"],"keel":["🇨🇨"],"congo":["🇨🇩","🇨🇬"],"kinshasa":["🇨🇩"],"central":["🇨🇫"],"african":["🇨🇫"],"republic":["🇨🇫","🇩🇴"],"brazzaville":["🇨🇬"],"switzerland":["🇨🇭"],"cote":["🇨🇮"],"ivoire":["🇨🇮"],"chile":["🇨🇱"],"cameroon":["🇨🇲"],"china":["🇨🇳","🇭🇰","🇲🇴"],"colombia":["🇨🇴"],"clipperton":["🇨🇵"],"costa":["🇨🇷"],"rica":["🇨🇷"],"cuba":["🇨🇺"],"cape":["🇨🇻"],"verde":["🇨🇻"],"curacao":["🇨🇼"],"cyprus":["🇨🇾"],"czechia":["🇨🇿"],"germany":["🇩🇪"],"diego":["🇩🇬"],"garcia":["🇩🇬"],"djibouti":["🇩🇯"],"denmark":["🇩🇰"],"dominica":["🇩🇲"],"dominican":["🇩🇴"],"algeria":["🇩🇿"],"ceuta":["🇪🇦"],"melilla":["🇪🇦"],"ecuador":["🇪🇨"],"estonia":["🇪🇪"],"egypt":["🇪🇬"],"western":["🇪🇭"],"sahara":["🇪🇭"],"eritrea":["🇪🇷"],"spain":["🇪🇸"],"ethiopia":["🇪🇹"],"european":["🇪🇺"],"union":["🇪🇺"],"finland":["🇫🇮"],"fiji":["🇫🇯"],"falkland":["🇫🇰"],"micronesia":["🇫🇲"],"faroe":["🇫🇴"],"france":["🇫🇷"],"gabon":["🇬🇦"],"kingdom":["🇬🇧"],"grenada":["🇬🇩"],"georgia":["🇬🇪","🇬🇸"],"guiana":["🇬🇫"],"guernsey":["🇬🇬"],"ghana":["🇬🇭"],"gibraltar":["🇬🇮"],"greenland":["🇬🇱"],"gambia":["🇬🇲"],"guinea":["🇬🇳","🇬🇶","🇬🇼","🇵🇬"],"guadeloupe":["🇬🇵"],"equatorial":["🇬🇶"],"greece":["🇬🇷"],"south":["🇬🇸","🇰🇷","🇸🇸","🇿🇦"],"guatemala":["🇬🇹"],"guam":["🇬🇺"],"bissau":["🇬🇼"],"guyana":["🇬🇾"],"hong":["🇭🇰"],"kong":["🇭🇰"],"sar":["🇭🇰","🇲🇴"],"heard":["🇭🇲"],"mcdonald":["🇭🇲"],"honduras":["🇭🇳"],"croatia":["🇭🇷"],"haiti":["🇭🇹"],"hungary":["🇭🇺"],"canary":["🇮🇨"],"indonesia":["🇮🇩"],"ireland":["🇮🇪"],"israel":["🇮🇱"],"isle":["🇮🇲"],"india":["🇮🇳"],"british":["🇮🇴","🇻🇬"],"indian":["🇮🇴"],"ocean":["🇮🇴"],"territory":["🇮🇴"],"iraq":["🇮🇶"],"iran":["🇮🇷"],"iceland":["🇮🇸"],"italy":["🇮🇹"],"jersey":["🇯🇪"],"jamaica":["🇯🇲"],"jordan":["🇯🇴"],"kenya":["🇰🇪"],"kyrgyzstan":["🇰🇬"],"cambodia":["🇰🇭"],"kiribati":["🇰🇮"],"comoros":["🇰🇲"],"kitts":["🇰🇳"],"nevis":["🇰🇳"],"north":["🇰🇵","🇲🇰"],"korea":["🇰🇵","🇰🇷"],"kuwait":["🇰🇼"],"cayman":["🇰🇾"],"kazakhstan":["🇰🇿"],"laos":["🇱🇦"],"lebanon":["🇱🇧"],"lucia":["🇱🇨"],"liechtenstein":["🇱🇮"],"sri":["🇱🇰"],"lanka":["🇱🇰"],"liberia":["🇱🇷"],"lesotho":["🇱🇸"],"lithuania":["🇱🇹"],"luxembourg":["🇱🇺"],"latvia":["🇱🇻"],"libya":["🇱🇾"],"morocco":["🇲🇦"],"monaco":["🇲🇨"],"moldova":["🇲🇩"],"montenegro":["🇲🇪"],"martin":["🇲🇫"],"madagascar":["🇲🇬"],"marshall":["🇲🇭"],"macedonia":["🇲🇰"],"mali":["🇲🇱"],"myanmar":["🇲🇲"],"burma":["🇲🇲"],"mongolia":["🇲🇳"],"macao":["🇲🇴"],"northern":["🇲🇵"],"mariana":["🇲🇵"],"martinique":["🇲🇶"],"mauritania":["🇲🇷"],"montserrat":["🇲🇸"],"malta":["🇲🇹"],"mauritius":["🇲🇺"],"maldives":["🇲🇻"],"malawi":["🇲🇼"],"mexico":["🇲🇽"],"malaysia":["🇲🇾"],"mozambique":["🇲🇿"],"namibia":["🇳🇦"],"caledonia":["🇳🇨"],"niger":["🇳🇪"],"norfolk":["🇳🇫"],"nigeria":["🇳🇬"],"nicaragua":["🇳🇮"],"norway":["🇳🇴"],"nepal":["🇳🇵"],"nauru":["🇳🇷"],"niue":["🇳🇺"],"zealand":["🇳🇿"],"oman":["🇴🇲"],"panama":["🇵🇦"],"peru":["🇵🇪"],"polynesia":["🇵🇫"],"papua":["🇵🇬"],"philippines":["🇵🇭"],"pakistan":["🇵🇰"],"poland":["🇵🇱"],"pierre":["🇵🇲"],"miquelon":["🇵🇲"],"pitcairn":["🇵🇳"],"puerto":["🇵🇷"],"rico":["🇵🇷"],"palestinian":["🇵🇸"],"territories":["🇵🇸","🇹🇫"],"portugal":["🇵🇹"],"palau":["🇵🇼"],"paraguay":["🇵🇾"],"qatar":["🇶🇦"],"reunion":["🇷🇪"],"romania":["🇷🇴"],"serbia":["🇷🇸"],"russia":["🇷🇺"],"rwanda":["🇷🇼"],"saudi":["🇸🇦"],"arabia":["🇸🇦"],"solomon":["🇸🇧"],"seychelles":["🇸🇨"],"sudan":["🇸🇩","🇸🇸"],"sweden":["🇸🇪"],"singapore":["🇸🇬"],"helena":["🇸🇭"],"slovenia":["🇸🇮"],"svalbard":["🇸🇯"],"jan":["🇸🇯"],"mayen":["🇸🇯"],"slovakia":["🇸🇰"],"sierra":["🇸🇱"],"leone":["🇸🇱"],"san":["🇸🇲"],"marino":["🇸🇲"],"senegal":["🇸🇳"],"somalia":["🇸🇴"],"suriname":["🇸🇷"],"sao":["🇸🇹"],"tome":["🇸🇹"],"principe":["🇸🇹"],"el":["🇸🇻"],"salvador":["🇸🇻"],"sint":["🇸🇽"],"maarten":["🇸🇽"],"syria":["🇸🇾"],"eswatini":["🇸🇿"],"tristan":["🇹🇦"],"da":["🇹🇦"],"cunha":["🇹🇦"],"turks":["🇹🇨"],"caicos":["🇹🇨"],"chad":["🇹🇩"],"southern":["🇹🇫"],"togo":["🇹🇬"],"thailand":["🇹🇭"],"tajikistan":["🇹🇯"],"tokelau":["🇹🇰"],"timor":["🇹🇱"],"leste":["🇹🇱"],"turkmenistan":["🇹🇲"],"tunisia":["🇹🇳"],"tonga":["🇹🇴"],"trinidad":["🇹🇹"],"tobago":["🇹🇹"],"tuvalu":["🇹🇻"],"taiwan":["🇹🇼"],"tanzania":["🇹🇿"],"ukraine":["🇺🇦"],"uganda":["🇺🇬"],"us":["🇺🇲","🇻🇮"],"outly":["🇺🇲"],"nations":["🇺🇳"],"states":["🇺🇸"],"uruguay":["🇺🇾"],"uzbekistan":["🇺🇿"],"vatican":["🇻🇦"],"city":["🇻🇦"],"vincent":["🇻🇨"],"grenadines":["🇻🇨"],"venezuela":["🇻🇪"],"virgin":["🇻🇬","🇻🇮"],"vietnam":["🇻🇳"],"vanuatu":["🇻🇺"],"wallis":["🇼🇫"],"futuna":["🇼🇫"],"kosovo":["🇽🇰"],"yemen":["🇾🇪"],"mayotte":["🇾🇹"],"zambia":["🇿🇲"],"zimbabwe":["🇿🇼"],"england":["🏴󠁧󠁢󠁥󠁮󠁧󠁿"],"scotland":["🏴󠁧󠁢󠁳󠁣󠁴󠁿"],"wales":["🏴󠁧󠁢󠁷󠁬󠁳󠁿"]}
},{}],28:[function(require,module,exports){
module.exports={"߀":"0","́":""," ":" ","Ⓐ":"A","Ａ":"A","À":"A","Á":"A","Â":"A","Ầ":"A","Ấ":"A","Ẫ":"A","Ẩ":"A","Ã":"A","Ā":"A","Ă":"A","Ằ":"A","Ắ":"A","Ẵ":"A","Ẳ":"A","Ȧ":"A","Ǡ":"A","Ä":"A","Ǟ":"A","Ả":"A","Å":"A","Ǻ":"A","Ǎ":"A","Ȁ":"A","Ȃ":"A","Ạ":"A","Ậ":"A","Ặ":"A","Ḁ":"A","Ą":"A","Ⱥ":"A","Ɐ":"A","Ꜳ":"AA","Æ":"AE","Ǽ":"AE","Ǣ":"AE","Ꜵ":"AO","Ꜷ":"AU","Ꜹ":"AV","Ꜻ":"AV","Ꜽ":"AY","Ⓑ":"B","Ｂ":"B","Ḃ":"B","Ḅ":"B","Ḇ":"B","Ƀ":"B","Ɓ":"B","ｃ":"C","Ⓒ":"C","Ｃ":"C","Ꜿ":"C","Ḉ":"C","Ç":"C","Ⓓ":"D","Ｄ":"D","Ḋ":"D","Ď":"D","Ḍ":"D","Ḑ":"D","Ḓ":"D","Ḏ":"D","Đ":"D","Ɗ":"D","Ɖ":"D","ᴅ":"D","Ꝺ":"D","Ð":"Dh","Ǳ":"DZ","Ǆ":"DZ","ǲ":"Dz","ǅ":"Dz","ɛ":"E","Ⓔ":"E","Ｅ":"E","È":"E","É":"E","Ê":"E","Ề":"E","Ế":"E","Ễ":"E","Ể":"E","Ẽ":"E","Ē":"E","Ḕ":"E","Ḗ":"E","Ĕ":"E","Ė":"E","Ë":"E","Ẻ":"E","Ě":"E","Ȅ":"E","Ȇ":"E","Ẹ":"E","Ệ":"E","Ȩ":"E","Ḝ":"E","Ę":"E","Ḙ":"E","Ḛ":"E","Ɛ":"E","Ǝ":"E","ᴇ":"E","ꝼ":"F","Ⓕ":"F","Ｆ":"F","Ḟ":"F","Ƒ":"F","Ꝼ":"F","Ⓖ":"G","Ｇ":"G","Ǵ":"G","Ĝ":"G","Ḡ":"G","Ğ":"G","Ġ":"G","Ǧ":"G","Ģ":"G","Ǥ":"G","Ɠ":"G","Ꞡ":"G","Ᵹ":"G","Ꝿ":"G","ɢ":"G","Ⓗ":"H","Ｈ":"H","Ĥ":"H","Ḣ":"H","Ḧ":"H","Ȟ":"H","Ḥ":"H","Ḩ":"H","Ḫ":"H","Ħ":"H","Ⱨ":"H","Ⱶ":"H","Ɥ":"H","Ⓘ":"I","Ｉ":"I","Ì":"I","Í":"I","Î":"I","Ĩ":"I","Ī":"I","Ĭ":"I","İ":"I","Ï":"I","Ḯ":"I","Ỉ":"I","Ǐ":"I","Ȉ":"I","Ȋ":"I","Ị":"I","Į":"I","Ḭ":"I","Ɨ":"I","Ⓙ":"J","Ｊ":"J","Ĵ":"J","Ɉ":"J","ȷ":"J","Ⓚ":"K","Ｋ":"K","Ḱ":"K","Ǩ":"K","Ḳ":"K","Ķ":"K","Ḵ":"K","Ƙ":"K","Ⱪ":"K","Ꝁ":"K","Ꝃ":"K","Ꝅ":"K","Ꞣ":"K","Ⓛ":"L","Ｌ":"L","Ŀ":"L","Ĺ":"L","Ľ":"L","Ḷ":"L","Ḹ":"L","Ļ":"L","Ḽ":"L","Ḻ":"L","Ł":"L","Ƚ":"L","Ɫ":"L","Ⱡ":"L","Ꝉ":"L","Ꝇ":"L","Ꞁ":"L","Ǉ":"LJ","ǈ":"Lj","Ⓜ":"M","Ｍ":"M","Ḿ":"M","Ṁ":"M","Ṃ":"M","Ɱ":"M","Ɯ":"M","ϻ":"M","Ꞥ":"N","Ƞ":"N","Ⓝ":"N","Ｎ":"N","Ǹ":"N","Ń":"N","Ñ":"N","Ṅ":"N","Ň":"N","Ṇ":"N","Ņ":"N","Ṋ":"N","Ṉ":"N","Ɲ":"N","Ꞑ":"N","ᴎ":"N","Ǌ":"NJ","ǋ":"Nj","Ⓞ":"O","Ｏ":"O","Ò":"O","Ó":"O","Ô":"O","Ồ":"O","Ố":"O","Ỗ":"O","Ổ":"O","Õ":"O","Ṍ":"O","Ȭ":"O","Ṏ":"O","Ō":"O","Ṑ":"O","Ṓ":"O","Ŏ":"O","Ȯ":"O","Ȱ":"O","Ö":"O","Ȫ":"O","Ỏ":"O","Ő":"O","Ǒ":"O","Ȍ":"O","Ȏ":"O","Ơ":"O","Ờ":"O","Ớ":"O","Ỡ":"O","Ở":"O","Ợ":"O","Ọ":"O","Ộ":"O","Ǫ":"O","Ǭ":"O","Ø":"O","Ǿ":"O","Ɔ":"O","Ɵ":"O","Ꝋ":"O","Ꝍ":"O","Œ":"OE","Ƣ":"OI","Ꝏ":"OO","Ȣ":"OU","Ⓟ":"P","Ｐ":"P","Ṕ":"P","Ṗ":"P","Ƥ":"P","Ᵽ":"P","Ꝑ":"P","Ꝓ":"P","Ꝕ":"P","Ⓠ":"Q","Ｑ":"Q","Ꝗ":"Q","Ꝙ":"Q","Ɋ":"Q","Ⓡ":"R","Ｒ":"R","Ŕ":"R","Ṙ":"R","Ř":"R","Ȑ":"R","Ȓ":"R","Ṛ":"R","Ṝ":"R","Ŗ":"R","Ṟ":"R","Ɍ":"R","Ɽ":"R","Ꝛ":"R","Ꞧ":"R","Ꞃ":"R","Ⓢ":"S","Ｓ":"S","ẞ":"S","Ś":"S","Ṥ":"S","Ŝ":"S","Ṡ":"S","Š":"S","Ṧ":"S","Ṣ":"S","Ṩ":"S","Ș":"S","Ş":"S","Ȿ":"S","Ꞩ":"S","Ꞅ":"S","Ⓣ":"T","Ｔ":"T","Ṫ":"T","Ť":"T","Ṭ":"T","Ț":"T","Ţ":"T","Ṱ":"T","Ṯ":"T","Ŧ":"T","Ƭ":"T","Ʈ":"T","Ⱦ":"T","Ꞇ":"T","Þ":"Th","Ꜩ":"TZ","Ⓤ":"U","Ｕ":"U","Ù":"U","Ú":"U","Û":"U","Ũ":"U","Ṹ":"U","Ū":"U","Ṻ":"U","Ŭ":"U","Ü":"U","Ǜ":"U","Ǘ":"U","Ǖ":"U","Ǚ":"U","Ủ":"U","Ů":"U","Ű":"U","Ǔ":"U","Ȕ":"U","Ȗ":"U","Ư":"U","Ừ":"U","Ứ":"U","Ữ":"U","Ử":"U","Ự":"U","Ụ":"U","Ṳ":"U","Ų":"U","Ṷ":"U","Ṵ":"U","Ʉ":"U","Ⓥ":"V","Ｖ":"V","Ṽ":"V","Ṿ":"V","Ʋ":"V","Ꝟ":"V","Ʌ":"V","Ꝡ":"VY","Ⓦ":"W","Ｗ":"W","Ẁ":"W","Ẃ":"W","Ŵ":"W","Ẇ":"W","Ẅ":"W","Ẉ":"W","Ⱳ":"W","Ⓧ":"X","Ｘ":"X","Ẋ":"X","Ẍ":"X","Ⓨ":"Y","Ｙ":"Y","Ỳ":"Y","Ý":"Y","Ŷ":"Y","Ỹ":"Y","Ȳ":"Y","Ẏ":"Y","Ÿ":"Y","Ỷ":"Y","Ỵ":"Y","Ƴ":"Y","Ɏ":"Y","Ỿ":"Y","Ⓩ":"Z","Ｚ":"Z","Ź":"Z","Ẑ":"Z","Ż":"Z","Ž":"Z","Ẓ":"Z","Ẕ":"Z","Ƶ":"Z","Ȥ":"Z","Ɀ":"Z","Ⱬ":"Z","Ꝣ":"Z","ⓐ":"a","ａ":"a","ẚ":"a","à":"a","á":"a","â":"a","ầ":"a","ấ":"a","ẫ":"a","ẩ":"a","ã":"a","ā":"a","ă":"a","ằ":"a","ắ":"a","ẵ":"a","ẳ":"a","ȧ":"a","ǡ":"a","ä":"a","ǟ":"a","ả":"a","å":"a","ǻ":"a","ǎ":"a","ȁ":"a","ȃ":"a","ạ":"a","ậ":"a","ặ":"a","ḁ":"a","ą":"a","ⱥ":"a","ɐ":"a","ɑ":"a","ꜳ":"aa","æ":"ae","ǽ":"ae","ǣ":"ae","ꜵ":"ao","ꜷ":"au","ꜹ":"av","ꜻ":"av","ꜽ":"ay","ⓑ":"b","ｂ":"b","ḃ":"b","ḅ":"b","ḇ":"b","ƀ":"b","ƃ":"b","ɓ":"b","Ƃ":"b","ⓒ":"c","ć":"c","ĉ":"c","ċ":"c","č":"c","ç":"c","ḉ":"c","ƈ":"c","ȼ":"c","ꜿ":"c","ↄ":"c","C":"c","Ć":"c","Ĉ":"c","Ċ":"c","Č":"c","Ƈ":"c","Ȼ":"c","ⓓ":"d","ｄ":"d","ḋ":"d","ď":"d","ḍ":"d","ḑ":"d","ḓ":"d","ḏ":"d","đ":"d","ƌ":"d","ɖ":"d","ɗ":"d","Ƌ":"d","Ꮷ":"d","ԁ":"d","Ɦ":"d","ð":"dh","ǳ":"dz","ǆ":"dz","ⓔ":"e","ｅ":"e","è":"e","é":"e","ê":"e","ề":"e","ế":"e","ễ":"e","ể":"e","ẽ":"e","ē":"e","ḕ":"e","ḗ":"e","ĕ":"e","ė":"e","ë":"e","ẻ":"e","ě":"e","ȅ":"e","ȇ":"e","ẹ":"e","ệ":"e","ȩ":"e","ḝ":"e","ę":"e","ḙ":"e","ḛ":"e","ɇ":"e","ǝ":"e","ⓕ":"f","ｆ":"f","ḟ":"f","ƒ":"f","ﬀ":"ff","ﬁ":"fi","ﬂ":"fl","ﬃ":"ffi","ﬄ":"ffl","ⓖ":"g","ｇ":"g","ǵ":"g","ĝ":"g","ḡ":"g","ğ":"g","ġ":"g","ǧ":"g","ģ":"g","ǥ":"g","ɠ":"g","ꞡ":"g","ꝿ":"g","ᵹ":"g","ⓗ":"h","ｈ":"h","ĥ":"h","ḣ":"h","ḧ":"h","ȟ":"h","ḥ":"h","ḩ":"h","ḫ":"h","ẖ":"h","ħ":"h","ⱨ":"h","ⱶ":"h","ɥ":"h","ƕ":"hv","ⓘ":"i","ｉ":"i","ì":"i","í":"i","î":"i","ĩ":"i","ī":"i","ĭ":"i","ï":"i","ḯ":"i","ỉ":"i","ǐ":"i","ȉ":"i","ȋ":"i","ị":"i","į":"i","ḭ":"i","ɨ":"i","ı":"i","ⓙ":"j","ｊ":"j","ĵ":"j","ǰ":"j","ɉ":"j","ⓚ":"k","ｋ":"k","ḱ":"k","ǩ":"k","ḳ":"k","ķ":"k","ḵ":"k","ƙ":"k","ⱪ":"k","ꝁ":"k","ꝃ":"k","ꝅ":"k","ꞣ":"k","ⓛ":"l","ｌ":"l","ŀ":"l","ĺ":"l","ľ":"l","ḷ":"l","ḹ":"l","ļ":"l","ḽ":"l","ḻ":"l","ſ":"l","ł":"l","ƚ":"l","ɫ":"l","ⱡ":"l","ꝉ":"l","ꞁ":"l","ꝇ":"l","ɭ":"l","ǉ":"lj","ⓜ":"m","ｍ":"m","ḿ":"m","ṁ":"m","ṃ":"m","ɱ":"m","ɯ":"m","ⓝ":"n","ｎ":"n","ǹ":"n","ń":"n","ñ":"n","ṅ":"n","ň":"n","ṇ":"n","ņ":"n","ṋ":"n","ṉ":"n","ƞ":"n","ɲ":"n","ŉ":"n","ꞑ":"n","ꞥ":"n","ԉ":"n","ǌ":"nj","ⓞ":"o","ｏ":"o","ò":"o","ó":"o","ô":"o","ồ":"o","ố":"o","ỗ":"o","ổ":"o","õ":"o","ṍ":"o","ȭ":"o","ṏ":"o","ō":"o","ṑ":"o","ṓ":"o","ŏ":"o","ȯ":"o","ȱ":"o","ö":"o","ȫ":"o","ỏ":"o","ő":"o","ǒ":"o","ȍ":"o","ȏ":"o","ơ":"o","ờ":"o","ớ":"o","ỡ":"o","ở":"o","ợ":"o","ọ":"o","ộ":"o","ǫ":"o","ǭ":"o","ø":"o","ǿ":"o","ꝋ":"o","ꝍ":"o","ɵ":"o","ɔ":"o","ᴑ":"o","œ":"oe","ƣ":"oi","ꝏ":"oo","ȣ":"ou","ⓟ":"p","ｐ":"p","ṕ":"p","ṗ":"p","ƥ":"p","ᵽ":"p","ꝑ":"p","ꝓ":"p","ꝕ":"p","ρ":"p","ⓠ":"q","ｑ":"q","ɋ":"q","ꝗ":"q","ꝙ":"q","ⓡ":"r","ｒ":"r","ŕ":"r","ṙ":"r","ř":"r","ȑ":"r","ȓ":"r","ṛ":"r","ṝ":"r","ŗ":"r","ṟ":"r","ɍ":"r","ɽ":"r","ꝛ":"r","ꞧ":"r","ꞃ":"r","ⓢ":"s","ｓ":"s","ś":"s","ṥ":"s","ŝ":"s","ṡ":"s","š":"s","ṧ":"s","ṣ":"s","ṩ":"s","ș":"s","ş":"s","ȿ":"s","ꞩ":"s","ꞅ":"s","ẛ":"s","ʂ":"s","ß":"ss","ⓣ":"t","ｔ":"t","ṫ":"t","ẗ":"t","ť":"t","ṭ":"t","ț":"t","ţ":"t","ṱ":"t","ṯ":"t","ŧ":"t","ƭ":"t","ʈ":"t","ⱦ":"t","ꞇ":"t","þ":"th","ꜩ":"tz","ⓤ":"u","ｕ":"u","ù":"u","ú":"u","û":"u","ũ":"u","ṹ":"u","ū":"u","ṻ":"u","ŭ":"u","ü":"u","ǜ":"u","ǘ":"u","ǖ":"u","ǚ":"u","ủ":"u","ů":"u","ű":"u","ǔ":"u","ȕ":"u","ȗ":"u","ư":"u","ừ":"u","ứ":"u","ữ":"u","ử":"u","ự":"u","ụ":"u","ṳ":"u","ų":"u","ṷ":"u","ṵ":"u","ʉ":"u","ⓥ":"v","ｖ":"v","ṽ":"v","ṿ":"v","ʋ":"v","ꝟ":"v","ʌ":"v","ꝡ":"vy","ⓦ":"w","ｗ":"w","ẁ":"w","ẃ":"w","ŵ":"w","ẇ":"w","ẅ":"w","ẘ":"w","ẉ":"w","ⱳ":"w","ⓧ":"x","ｘ":"x","ẋ":"x","ẍ":"x","ⓨ":"y","ｙ":"y","ỳ":"y","ý":"y","ŷ":"y","ỹ":"y","ȳ":"y","ẏ":"y","ÿ":"y","ỷ":"y","ẙ":"y","ỵ":"y","ƴ":"y","ɏ":"y","ỿ":"y","ⓩ":"z","ｚ":"z","ź":"z","ẑ":"z","ż":"z","ž":"z","ẓ":"z","ẕ":"z","ƶ":"z","ȥ":"z","ɀ":"z","ⱬ":"z","ꝣ":"z"}
},{}],29:[function(require,module,exports){
module.exports=[{"s":9728,"e":9747,"w":1},{"s":9748,"e":9749,"w":2},{"s":9750,"e":9799,"w":1},{"s":9800,"e":9811,"w":2},{"s":9812,"e":9854,"w":1},{"s":9855,"e":9855,"w":2},{"s":9856,"e":9874,"w":1},{"s":9875,"e":9875,"w":2},{"s":9876,"e":9888,"w":1},{"s":9889,"e":9889,"w":2},{"s":9890,"e":9897,"w":1},{"s":9898,"e":9899,"w":2},{"s":9900,"e":9916,"w":1},{"s":9917,"e":9918,"w":2},{"s":9919,"e":9923,"w":1},{"s":9924,"e":9925,"w":2},{"s":9926,"e":9933,"w":1},{"s":9934,"e":9934,"w":2},{"s":9935,"e":9939,"w":1},{"s":9940,"e":9940,"w":2},{"s":9941,"e":9961,"w":1},{"s":9962,"e":9962,"w":2},{"s":9963,"e":9969,"w":1},{"s":9970,"e":9971,"w":2},{"s":9972,"e":9972,"w":1},{"s":9973,"e":9973,"w":2},{"s":9974,"e":9977,"w":1},{"s":9978,"e":9978,"w":2},{"s":9979,"e":9980,"w":1},{"s":9981,"e":9981,"w":2},{"s":9982,"e":9983,"w":1},{"s":9984,"e":9988,"w":1},{"s":9989,"e":9989,"w":2},{"s":9990,"e":9993,"w":1},{"s":9994,"e":9995,"w":2},{"s":9996,"e":10023,"w":1},{"s":10024,"e":10024,"w":2},{"s":10025,"e":10059,"w":1},{"s":10060,"e":10060,"w":2},{"s":10061,"e":10061,"w":1},{"s":10062,"e":10062,"w":2},{"s":10063,"e":10066,"w":1},{"s":10067,"e":10069,"w":2},{"s":10070,"e":10070,"w":1},{"s":10071,"e":10071,"w":2},{"s":10072,"e":10132,"w":1},{"s":10133,"e":10135,"w":2},{"s":10136,"e":10159,"w":1},{"s":10160,"e":10160,"w":2},{"s":10161,"e":10174,"w":1},{"s":10175,"e":10175,"w":2},{"s":126976,"e":126979,"w":1},{"s":126980,"e":126980,"w":2},{"s":126981,"e":127182,"w":1},{"s":127183,"e":127183,"w":2},{"s":127184,"e":127373,"w":1},{"s":127374,"e":127374,"w":2},{"s":127375,"e":127376,"w":1},{"s":127377,"e":127386,"w":2},{"s":127387,"e":127487,"w":1},{"s":127744,"e":127776,"w":2},{"s":127777,"e":127788,"w":1},{"s":127789,"e":127797,"w":2},{"s":127798,"e":127798,"w":1},{"s":127799,"e":127868,"w":2},{"s":127869,"e":127869,"w":1},{"s":127870,"e":127891,"w":2},{"s":127892,"e":127903,"w":1},{"s":127904,"e":127946,"w":2},{"s":127947,"e":127950,"w":1},{"s":127951,"e":127955,"w":2},{"s":127956,"e":127967,"w":1},{"s":127968,"e":127984,"w":2},{"s":127985,"e":127987,"w":1},{"s":127988,"e":127988,"w":2},{"s":127989,"e":127991,"w":1},{"s":127992,"e":127994,"w":2},{"s":128000,"e":128062,"w":2},{"s":128063,"e":128063,"w":1},{"s":128064,"e":128064,"w":2},{"s":128065,"e":128065,"w":1},{"s":128066,"e":128252,"w":2},{"s":128253,"e":128254,"w":1},{"s":128255,"e":128317,"w":2},{"s":128318,"e":128330,"w":1},{"s":128331,"e":128334,"w":2},{"s":128335,"e":128335,"w":1},{"s":128336,"e":128359,"w":2},{"s":128360,"e":128377,"w":1},{"s":128378,"e":128378,"w":2},{"s":128379,"e":128404,"w":1},{"s":128405,"e":128406,"w":2},{"s":128407,"e":128419,"w":1},{"s":128420,"e":128420,"w":2},{"s":128421,"e":128506,"w":1},{"s":128507,"e":128591,"w":2},{"s":128592,"e":128639,"w":1},{"s":128640,"e":128709,"w":2},{"s":128710,"e":128715,"w":1},{"s":128716,"e":128716,"w":2},{"s":128717,"e":128719,"w":1},{"s":128720,"e":128722,"w":2},{"s":128723,"e":128724,"w":1},{"s":128725,"e":128727,"w":2},{"s":128728,"e":128746,"w":1},{"s":128747,"e":128748,"w":2},{"s":128749,"e":128755,"w":1},{"s":128756,"e":128764,"w":2},{"s":128765,"e":128991,"w":1},{"s":128992,"e":129003,"w":2},{"s":129004,"e":129291,"w":1},{"s":129292,"e":129338,"w":2},{"s":129339,"e":129339,"w":1},{"s":129340,"e":129349,"w":2},{"s":129350,"e":129350,"w":1},{"s":129351,"e":129400,"w":2},{"s":129401,"e":129401,"w":1},{"s":129402,"e":129483,"w":2},{"s":129484,"e":129484,"w":1},{"s":129485,"e":129535,"w":2},{"s":129536,"e":129647,"w":1},{"s":129648,"e":129652,"w":2},{"s":129653,"e":129655,"w":1},{"s":129656,"e":129658,"w":2},{"s":129659,"e":129663,"w":1},{"s":129664,"e":129670,"w":2},{"s":129671,"e":129679,"w":1},{"s":129680,"e":129704,"w":2},{"s":129705,"e":129711,"w":1},{"s":129712,"e":129718,"w":2},{"s":129719,"e":129727,"w":1},{"s":129728,"e":129730,"w":2},{"s":129731,"e":129743,"w":1},{"s":129744,"e":129750,"w":2},{"s":129751,"e":129791,"w":1}]

},{}],30:[function(require,module,exports){
/*
	String Kit

	Copyright (c) 2014 - 2021 Cédric Ronvel

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



const latinizeMap = require( './json-data/latinize-map.json' ) ;

module.exports = function( str ) {
	return str.replace( /[^\u0000-\u007e]/g , ( c ) => { return latinizeMap[ c ] || c ; } ) ;
} ;



},{"./json-data/latinize-map.json":28}],31:[function(require,module,exports){
/*
	String Kit

	Copyright (c) 2014 - 2021 Cédric Ronvel

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



exports.resize = function( str , length ) {
	if ( str.length === length ) {
		return str ;
	}
	else if ( str.length > length ) {
		return str.slice( 0 , length ) ;
	}

	return str + ' '.repeat( length - str.length ) ;

} ;



exports.occurrenceCount = function( str , subStr , overlap = false ) {
	if ( ! str || ! subStr ) { return 0 ; }

	var count = 0 , index = 0 ,
		inc = overlap ? 1 : subStr.length ;

	while ( ( index = str.indexOf( subStr , index ) ) !== -1 ) {
		count ++ ;
		index += inc ;
	}

	return count ;
} ;


},{}],32:[function(require,module,exports){
/*
	String Kit

	Copyright (c) 2014 - 2021 Cédric Ronvel

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



const CONTROL_CLASS = 1 ;
const WORD_SEPARATOR_CLASS = 2 ;
const LETTER_CLASS = 3 ;
const NUMBER_CLASS = 4 ;
const SYMBOL_CLASS = 5 ;



function getCharacterClass( char , code ) {
	if ( isWordSeparator( code ) ) { return WORD_SEPARATOR_CLASS ; }
	if ( code <= 0x1f || code === 0x7f ) { return CONTROL_CLASS ; }
	if ( isNumber( code ) ) { return NUMBER_CLASS ; }
	// Here we assume that a letter is a char with a “case”
	if ( char.toUpperCase() !== char.toLowerCase() ) { return LETTER_CLASS ; }
	return SYMBOL_CLASS ;
}



function isWordSeparator( code ) {
	if (
		// space, tab, no-break space
		code === 0x20 || code === 0x09 || code === 0xa0 ||
		// hyphen, underscore
		code === 0x2d || code === 0x5f
	) {
		return true ;
	}

	return false ;
}



function isNumber( code ) {
	if ( code >= 0x30 && code <= 0x39 ) { return true ; }
	return false ;
}



function naturalSort( a , b ) {
	a = '' + a ;
	b = '' + b ;

	var aIndex , aEndIndex , aChar , aCode , aClass , aCharLc , aNumber ,
		aTrim = a.trim() ,
		aLength = aTrim.length ,
		bIndex , bEndIndex , bChar , bCode , bClass , bCharLc , bNumber ,
		bTrim = b.trim() ,
		bLength = bTrim.length ,
		advantage = 0 ;

	for ( aIndex = bIndex = 0 ; aIndex < aLength && bIndex < bLength ; aIndex ++ , bIndex ++ ) {
		aChar = aTrim[ aIndex ] ;
		bChar = bTrim[ bIndex ] ;
		aCode = aTrim.charCodeAt( aIndex ) ;
		bCode = bTrim.charCodeAt( bIndex ) ;
		aClass = getCharacterClass( aChar , aCode ) ;
		bClass = getCharacterClass( bChar , bCode ) ;
		if ( aClass !== bClass ) { return aClass - bClass ; }

		switch ( aClass ) {
			case WORD_SEPARATOR_CLASS :
				// Eat all white chars and continue
				while ( isWordSeparator( aTrim.charCodeAt( aIndex + 1 ) ) ) { aIndex ++ ; }
				while ( isWordSeparator( bTrim.charCodeAt( bIndex + 1 ) ) ) { bIndex ++ ; }
				break ;

			case CONTROL_CLASS :
			case SYMBOL_CLASS :
				if ( aCode !== bCode ) { return aCode - bCode ; }
				break ;

			case LETTER_CLASS :
				aCharLc = aChar.toLowerCase() ;
				bCharLc = bChar.toLowerCase() ;
				if ( aCharLc !== bCharLc ) { return aCharLc > bCharLc ? 1 : -1 ; }

				// As a last resort, we would sort uppercase first
				if ( ! advantage && aChar !== bChar ) { advantage = aChar !== aCharLc ? -1 : 1 ; }

				break ;

			case NUMBER_CLASS :
				// Lookup for a whole number and parse it
				aEndIndex = aIndex + 1 ;
				while ( isNumber( aTrim.charCodeAt( aEndIndex ) ) ) { aEndIndex ++ ; }
				aNumber = parseFloat( aTrim.slice( aIndex , aEndIndex ) ) ;

				bEndIndex = bIndex + 1 ;
				while ( isNumber( bTrim.charCodeAt( bEndIndex ) ) ) { bEndIndex ++ ; }
				bNumber = parseFloat( bTrim.slice( bIndex , bEndIndex ) ) ;

				if ( aNumber !== bNumber ) { return aNumber - bNumber ; }

				// As a last resort, we would sort the number with the less char first
				if ( ! advantage && aEndIndex - aIndex !== bEndIndex - bIndex ) { advantage = ( aEndIndex - aIndex ) - ( bEndIndex - bIndex ) ; }

				// Advance the index at the end of the number area
				aIndex = aEndIndex - 1 ;
				bIndex = bEndIndex - 1 ;
				break ;
		}
	}

	// If there was an “advantage”, use it now
	if ( advantage ) { return advantage ; }

	// Finally, sort by remaining char, or by trimmed length or by full length
	return ( aLength - aIndex ) - ( bLength - bIndex ) || aLength - bLength || a.length - b.length ;
}

module.exports = naturalSort ;


},{}],33:[function(require,module,exports){
/*
	String Kit

	Copyright (c) 2014 - 2021 Cédric Ronvel

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



var escape = require( './escape.js' ) ;



exports.regexp = {} ;



exports.regexp.array2alternatives = function array2alternatives( array ) {
	var i , sorted = array.slice() ;

	// Sort descending by string length
	sorted.sort( ( a , b ) => {
		return b.length - a.length ;
	} ) ;

	// Then escape what should be
	for ( i = 0 ; i < sorted.length ; i ++ ) {
		sorted[ i ] = escape.regExpPattern( sorted[ i ] ) ;
	}

	return sorted.join( '|' ) ;
} ;



},{"./escape.js":22}],34:[function(require,module,exports){
/*
	String Kit

	Copyright (c) 2014 - 2021 Cédric Ronvel

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



const stringKit = {} ;
module.exports = stringKit ;



/*
// Tier 0: add polyfills to stringKit
const polyfill = require( './polyfill.js' ) ;

for ( let fn_ in polyfill ) {
	stringKit[ fn ] = function( str , ... args ) {
		return polyfill[ fn ].call( str , ... args ) ;
	} ;
}
//*/



Object.assign( stringKit ,

	// Tier 1
	{ escape: require( './escape.js' ) } ,
	{ ansi: require( './ansi.js' ) } ,
	{ unicode: require( './unicode.js' ) }
) ;



Object.assign( stringKit ,

	// Tier 2
	require( './format.js' ) ,

	// Tier 3
	require( './misc.js' ) ,
	require( './inspect.js' ) ,
	require( './regexp.js' ) ,
	require( './camel.js' ) ,
	{
		latinize: require( './latinize.js' ) ,
		toTitleCase: require( './toTitleCase.js' ) ,
		wordwrap: require( './wordwrap.js' ) ,
		naturalSort: require( './naturalSort.js' ) ,
		fuzzy: require( './fuzzy.js' ) ,
		StringNumber: require( './StringNumber.js' ) ,
		english: require( './english.js' ) ,
		emoji: require( './emoji.js' )
	}
) ;



/*
// Install all polyfill into String.prototype
stringKit.installPolyfills = function installPolyfills() {
	for ( let fn in polyfill ) {
		if ( ! String.prototype[ fn ] ) {
			String.prototype[ fn ] = polyfill[ fn ] ;
		}
	}
} ;
//*/


},{"./StringNumber.js":17,"./ansi.js":18,"./camel.js":19,"./emoji.js":20,"./english.js":21,"./escape.js":22,"./format.js":23,"./fuzzy.js":24,"./inspect.js":25,"./latinize.js":30,"./misc.js":31,"./naturalSort.js":32,"./regexp.js":33,"./toTitleCase.js":35,"./unicode.js":36,"./wordwrap.js":37}],35:[function(require,module,exports){
/*
	String Kit

	Copyright (c) 2014 - 2021 Cédric Ronvel

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



const DEFAULT_OPTIONS = {
	underscoreToSpace: true ,
	lowerCaseWords: new Set( [
		// Articles
		'a' , 'an' , 'the' ,
		// Conjunctions (only coordinating conjunctions, maybe we will have to add subordinating and correlative conjunctions)
		'for' , 'and' , 'nor' , 'but' , 'or' , 'yet' , 'so' ,
		// Prepositions (there are more, but usually only preposition with 2 or 3 letters are lower-cased)
		'of' , 'on' , 'off' , 'in' , 'into' , 'by' , 'with' , 'to' , 'at' , 'up' , 'down' , 'as'
	] )
} ;



module.exports = ( str , options = DEFAULT_OPTIONS ) => {
	if ( ! str || typeof str !== 'string' ) { return '' ; }

	// Manage options
	var dashToSpace = options.dashToSpace ?? DEFAULT_OPTIONS.dashToSpace ,
		underscoreToSpace = options.underscoreToSpace ?? DEFAULT_OPTIONS.underscoreToSpace ,
		zealous = options.zealous ?? DEFAULT_OPTIONS.zealous ,
		preserveAllCaps = options.preserveAllCaps ?? DEFAULT_OPTIONS.preserveAllCaps ,
		lowerCaseWords = options.lowerCaseWords ?? DEFAULT_OPTIONS.lowerCaseWords ;

	lowerCaseWords =
		lowerCaseWords instanceof Set ? lowerCaseWords :
		Array.isArray( lowerCaseWords ) ? new Set( lowerCaseWords ) :
		null ;


	if ( dashToSpace ) { str = str.replace( /-+/g , ' ' ) ; }
	if ( underscoreToSpace ) { str = str.replace( /_+/g , ' ' ) ; }

	// Squash multiple spaces into only one, and trim
	str = str.replace( / +/g , ' ' ).trim() ;


	return str.replace( /[^\s_-]+/g , ( part , position ) => {
		// Check word that must be lower-cased (excluding the first and the last word)
		if ( lowerCaseWords && position && position + part.length < str.length ) {
			let lowerCased = part.toLowerCase() ;
			if ( lowerCaseWords.has( lowerCased ) ) { return lowerCased ; }
		}

		if ( zealous ) {
			if ( preserveAllCaps && part === part.toUpperCase() ) {
				// This is a ALLCAPS word
				return part ;
			}

			return part[ 0 ].toUpperCase() + part.slice( 1 ).toLowerCase() ;
		}

		return part[ 0 ].toUpperCase() + part.slice( 1 ) ;
	} ) ;
} ;


},{}],36:[function(require,module,exports){
/*
	String Kit

	Copyright (c) 2014 - 2021 Cédric Ronvel

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



/*
	Javascript does not use UTF-8 but UCS-2.
	The purpose of this module is to process correctly strings containing UTF-8 characters that take more than 2 bytes.

	Since the punycode module is deprecated in Node.js v8.x, this is an adaptation of punycode.ucs2.x
	as found on Aug 16th 2017 at: https://github.com/bestiejs/punycode.js/blob/master/punycode.js.

	2021 note -- Modern Javascript is way more unicode friendly since many years, e.g. `Array.from( string )` and `for ( char of string )` are unicode aware.
	Some methods here are now useless, but have been modernized to use the correct ES features.
*/



// Create the module and export it
const unicode = {} ;
module.exports = unicode ;



unicode.encode = array => String.fromCodePoint( ... array ) ;

// Decode a string into an array of unicode codepoints.
// The 2nd argument of Array.from() is a map function, it avoids creating intermediate array.
unicode.decode = str => Array.from( str , c => c.codePointAt( 0 ) ) ;

// DEPRECATED: This function is totally useless now, with modern JS.
unicode.firstCodePoint = str => str.codePointAt( 0 ) ;

// Extract only the first char.
unicode.firstChar = str => str.length ? String.fromCodePoint( str.codePointAt( 0 ) ) : undefined ;

// DEPRECATED: This function is totally useless now, with modern JS.
unicode.toArray = str => Array.from( str ) ;



// Decode a string into an array of Cell (used by Terminal-kit).
// Wide chars have an additionnal filler cell, so position is correct
unicode.toCells = ( Cell , str , tabWidth = 4 , linePosition = 0 , ... extraCellArgs ) => {
	var char , code , fillSize , width ,
		output = [] ;

	for ( char of str ) {
		code = char.codePointAt( 0 ) ;

		if ( code === 0x0a ) {	// New line
			linePosition = 0 ;
		}
		else if ( code === 0x09 ) {	// Tab
			// Depends upon the next tab-stop
			fillSize = tabWidth - ( linePosition % tabWidth ) - 1 ;
			//output.push( new Cell( '\t' , ... extraCellArgs ) ) ;
			output.push( new Cell( '\t' , 1 , ... extraCellArgs ) ) ;
			linePosition += 1 + fillSize ;

			// Add a filler cell
			while ( fillSize -- ) { output.push( new Cell( ' ' , -2 , ... extraCellArgs ) ) ; }
		}
		else {
			width = unicode.codePointWidth( code ) ,
			output.push( new Cell( char , width , ... extraCellArgs ) ) ;
			linePosition += width ;

			// Add an anti-filler cell (a cell with 0 width, following a wide char)
			while ( -- width > 0 ) { output.push( new Cell( ' ' , -1 , ... extraCellArgs ) ) ; }
		}
	}

	return output ;
} ;



unicode.fromCells = ( cells ) => {
	var cell , str = '' ;

	for ( cell of cells ) {
		if ( ! cell.filler ) { str += cell.char ; }
	}

	return str ;
} ;



// Get the length of an unicode string
// Mostly an adaptation of .decode(), not factorized for performance's sake (used by Terminal-kit)
// /!\ Use Array.from().length instead??? Not using it is potentially faster, but it needs benchmark to be sure.
unicode.length = str => {
	// for ... of is unicode-aware
	var char , length = 0 ;
	for ( char of str ) { length ++ ; }		/* eslint-disable-line no-unused-vars */
	return length ;
} ;



// Return a string that does not exceed the character limit
unicode.truncateLength = unicode.truncate = ( str , limit ) => {
	var position = 0 , length = 0 ;

	for ( let char of str ) {
		if ( length === limit ) { return str.slice( 0 , position ) ; }
		length ++ ;
		position += char.length ;
	}

	// The string remains unchanged
	return str ;
} ;



// Return the width of a string in a terminal/monospace font
unicode.width = str => {
	// for ... of is unicode-aware
	var char , count = 0 ;
	for ( char of str ) { count += unicode.codePointWidth( char.codePointAt( 0 ) ) ; }
	return count ;
} ;



// Return the width of an array of string in a terminal/monospace font
unicode.arrayWidth = ( array , limit ) => {
	var index , count = 0 ;

	if ( limit === undefined ) { limit = array.length ; }

	for ( index = 0 ; index < limit ; index ++ ) {
		count += unicode.isFullWidth( array[ index ] ) ? 2 : 1 ;
	}

	return count ;
} ;



// Userland may use this, it is more efficient than .truncateWidth() + .width(),
// and BTW even more than testing .width() then .truncateWidth() + .width()
var lastTruncateWidth = 0 ;
unicode.getLastTruncateWidth = () => lastTruncateWidth ;

// Return a string that does not exceed the width limit (taking wide-char into considerations)
unicode.widthLimit =	// DEPRECATED
unicode.truncateWidth = ( str , limit ) => {
	var char , charWidth , position = 0 ;

	// Module global:
	lastTruncateWidth = 0 ;

	for ( char of str ) {
		charWidth = unicode.codePointWidth( char.codePointAt( 0 ) ) ;

		if ( lastTruncateWidth + charWidth > limit ) {
			return str.slice( 0 , position ) ;
		}

		lastTruncateWidth += charWidth ;
		position += char.length ;
	}

	// The string remains unchanged
	return str ;
} ;



/*
	** PROBABLY DEPRECATED **

	Check if a UCS2 char is a surrogate pair.

	Returns:
		0: single char
		1: leading surrogate
		-1: trailing surrogate

	Note: it does not check input, to gain perfs.
*/
unicode.surrogatePair = char => {
	var code = char.charCodeAt( 0 ) ;

	if ( code < 0xd800 || code >= 0xe000 ) { return 0 ; }
	else if ( code < 0xdc00 ) { return 1 ; }
	return -1 ;
} ;



// Check if a character is a full-width char or not
unicode.isFullWidth = char => unicode.isFullWidthCodePoint( char.codePointAt( 0 ) ) ;

// Return the width of a char, leaner than .width() for one char
unicode.charWidth = char => unicode.codePointWidth( char.codePointAt( 0 ) ) ;



/*
	Build the Emoji width lookup.
	The ranges file (./lib/unicode-emoji-width-ranges.json) is produced by a Terminal-Kit script ([terminal-kit]/utilities/build-emoji-width-lookup.js),
	that writes each emoji and check the cursor location.
*/
const emojiWidthLookup = new Map() ;

( function() {
	var ranges = require( './json-data/unicode-emoji-width-ranges.json' ) ;
	for ( let range of ranges ) {
		for ( let i = range.s ; i <= range.e ; i ++ ) {
			emojiWidthLookup.set( i , range.w ) ;
		}
	}
} )() ;

/*
	Check if a codepoint represent a full-width char or not.
*/
unicode.codePointWidth = code => {
	// Assuming all emoji are wide here
	if ( unicode.isEmojiCodePoint( code ) ) {
		return emojiWidthLookup.get( code ) ?? 2 ;
	}

	// Code points are derived from:
	// http://www.unicode.org/Public/UNIDATA/EastAsianWidth.txt
	if ( code >= 0x1100 && (
		code <= 0x115f ||	// Hangul Jamo
		code === 0x2329 || // LEFT-POINTING ANGLE BRACKET
		code === 0x232a || // RIGHT-POINTING ANGLE BRACKET
		// CJK Radicals Supplement .. Enclosed CJK Letters and Months
		( 0x2e80 <= code && code <= 0x3247 && code !== 0x303f ) ||
		// Enclosed CJK Letters and Months .. CJK Unified Ideographs Extension A
		( 0x3250 <= code && code <= 0x4dbf ) ||
		// CJK Unified Ideographs .. Yi Radicals
		( 0x4e00 <= code && code <= 0xa4c6 ) ||
		// Hangul Jamo Extended-A
		( 0xa960 <= code && code <= 0xa97c ) ||
		// Hangul Syllables
		( 0xac00 <= code && code <= 0xd7a3 ) ||
		// CJK Compatibility Ideographs
		( 0xf900 <= code && code <= 0xfaff ) ||
		// Vertical Forms
		( 0xfe10 <= code && code <= 0xfe19 ) ||
		// CJK Compatibility Forms .. Small Form Variants
		( 0xfe30 <= code && code <= 0xfe6b ) ||
		// Halfwidth and Fullwidth Forms
		( 0xff01 <= code && code <= 0xff60 ) ||
		( 0xffe0 <= code && code <= 0xffe6 ) ||
		// Kana Supplement
		( 0x1b000 <= code && code <= 0x1b001 ) ||
		// Enclosed Ideographic Supplement
		( 0x1f200 <= code && code <= 0x1f251 ) ||
		// CJK Unified Ideographs Extension B .. Tertiary Ideographic Plane
		( 0x20000 <= code && code <= 0x3fffd )
	) ) {
		return 2 ;
	}

	if (
		unicode.isEmojiModifierCodePoint( code ) ||
		unicode.isZeroWidthDiacriticCodePoint( code )
	) {
		return 0 ;
	}

	return 1 ;
} ;

// For a true/false type of result
unicode.isFullWidthCodePoint = code => unicode.codePointWidth( code ) === 2 ;



// Convert normal ASCII chars to their full-width counterpart
unicode.toFullWidth = str => {
	return String.fromCodePoint( ... Array.from( str , char => {
		var code = char.codePointAt( 0 ) ;
		return code >= 33 && code <= 126  ?  0xff00 + code - 0x20  :  code ;
	} ) ) ;
} ;



// Check if a character is a diacritic with zero-width or not
unicode.isZeroWidthDiacritic = char => unicode.isZeroWidthDiacriticCodePoint( char.codePointAt( 0 ) ) ;

// Some doc found here: https://en.wikipedia.org/wiki/Combining_character
// Diacritics and other characters that combines with previous one (zero-width)
unicode.isZeroWidthDiacriticCodePoint = code =>
	// Combining Diacritical Marks
	( 0x300 <= code && code <= 0x36f ) ||
	// Combining Diacritical Marks Extended
	( 0x1ab0 <= code && code <= 0x1aff ) ||
	// Combining Diacritical Marks Supplement
	( 0x1dc0 <= code && code <= 0x1dff ) ||
	// Combining Diacritical Marks for Symbols
	( 0x20d0 <= code && code <= 0x20ff ) ||
	// Combining Half Marks
	( 0xfe20 <= code && code <= 0xfe2f ) ||
	// Dakuten and handakuten (japanese)
	code === 0x3099 || code === 0x309a ||
	// Devanagari
	( 0x900 <= code && code <= 0x903 ) ||
	( 0x93a <= code && code <= 0x957 && code !== 0x93d && code !== 0x950 ) ||
	code === 0x962 || code === 0x963 ||
	// Thai
	code === 0xe31 ||
	( 0xe34 <= code && code <= 0xe3a ) ||
	( 0xe47 <= code && code <= 0xe4e ) ;

// Check if a character is an emoji or not
unicode.isEmoji = char => unicode.isEmojiCodePoint( char.codePointAt( 0 ) ) ;

// Some doc found here: https://stackoverflow.com/questions/30470079/emoji-value-range
unicode.isEmojiCodePoint = code =>
	// Miscellaneous symbols
	( 0x2600 <= code && code <= 0x26ff ) ||
	// Dingbats
	( 0x2700 <= code && code <= 0x27bf ) ||
	// Emoji
	( 0x1f000 <= code && code <= 0x1f1ff ) ||
	( 0x1f300 <= code && code <= 0x1f3fa ) ||
	( 0x1f400 <= code && code <= 0x1faff ) ;

// Emoji modifier
unicode.isEmojiModifier = char => unicode.isEmojiModifierCodePoint( char.codePointAt( 0 ) ) ;
unicode.isEmojiModifierCodePoint = code =>
	( 0x1f3fb <= code && code <= 0x1f3ff ) ||	// (Fitzpatrick): https://en.wikipedia.org/wiki/Miscellaneous_Symbols_and_Pictographs#Emoji_modifiers
	code === 0xfe0f ;	// VARIATION SELECTOR-16 [VS16] {emoji variation selector}


},{"./json-data/unicode-emoji-width-ranges.json":29}],37:[function(require,module,exports){
/*
	String Kit

	Copyright (c) 2014 - 2021 Cédric Ronvel

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



const unicode = require( './unicode.js' ) ;



// French typography rules with '!', '?', ':' and ';'
const FRENCH_DOUBLE_GRAPH_TYPO = {
	'!': true ,
	'?': true ,
	':': true ,
	';': true
} ;



/*
	.wordwrap( str , width )
	.wordwrap( str , options )

	str: the string to process
	width: the max width (default to 80)
	options: object, where:
		width: the max width (default to 80)
		glue: (optional) the char used to join lines, by default: lines are joined with '\n',
		noJoin: (optional) if set: don't join, instead return an array of lines
		offset: (optional) offset of the first-line
		updateOffset: (optional) if set, options.offset is updated with the last line width
		noTrim: (optional) if set, don't right-trim lines, if not set, right-trim all lines except the last
		fill: (optional) if set, fill the remaining width with space (it forces noTrim)
		skipFn: (optional) a function used to skip a whole sequence, useful for special sequences
			like ANSI escape sequence, and so on...
		charWidthFn: (optional) a function used to compute the width of one char/group of chars
		regroupFn: (optional) a function used to regroup chars together
*/
module.exports = function wordwrap( str , options ) {
	var start = 0 , end , skipEnd , lineWidth , currentLine , currentWidth , length ,
		lastEnd , lastWidth , lastWasSpace , charWidthFn ,
		explicitNewLine = true ,
		strArray = unicode.toArray( str ) ,
		trimNewLine = false ,
		line , lines = [] ;

	if ( typeof options !== 'object' ) {
		options = { width: options } ;
	}

	// Catch NaN, zero or negative and non-number
	if ( ! options.width || typeof options.width !== 'number' || options.width <= 0 ) { options.width = 80 ; }

	lineWidth = options.offset ? options.width - options.offset : options.width ;

	if ( typeof options.glue !== 'string' ) { options.glue = '\n' ; }

	if ( options.regroupFn ) {
		strArray = options.regroupFn( strArray ) ;
		// If char are grouped, use unicode.width() as a default
		charWidthFn = options.charWidthFn || unicode.width ;
	}
	else {
		// If char are not grouped, use unicode.charWidth() as a default
		charWidthFn = options.charWidthFn || unicode.charWidth ;
	}

	length = strArray.length ;

	var getNextLine = () => {
		//originStart = start ;

		if ( ! explicitNewLine || trimNewLine ) {
			// Find the first non-space char
			while ( strArray[ start ] === ' ' ) { start ++ ; }

			if ( trimNewLine && strArray[ start ] === '\n' ) {
				explicitNewLine = true ;
				start ++ ;
				/*
				originStart = start ;
				while ( strArray[ start ] === ' ' ) { start ++ ; }
				*/
			}
		}

		if ( start >= length ) { return null ; }

		explicitNewLine = false ;
		trimNewLine = false ;
		lastWasSpace = false ;
		end = lastEnd = start ;
		currentWidth = lastWidth = 0 ;

		for ( ;; ) {
			if ( end >= length ) {
				return strArray.slice( start , end ).join( '' ) ;
			}

			if ( strArray[ end ] === '\n' ) {
				explicitNewLine = true ;
				currentLine = strArray.slice( start , end ++ ).join( '' ) ;

				if ( options.fill ) {
					currentLine += ' '.repeat( lineWidth - currentWidth ) ;
				}

				return currentLine ;
			}

			if ( options.skipFn ) {
				skipEnd = options.skipFn( strArray , end ) ;
				if ( skipEnd !== end ) {
					end = skipEnd ;
					continue ;
				}
			}

			if ( strArray[ end ] === ' ' && ! lastWasSpace && ! FRENCH_DOUBLE_GRAPH_TYPO[ strArray[ end + 1 ] ] ) {
				// This is the first space of a group of space
				lastEnd = end ;
				lastWidth = currentWidth ;
			}
			else {
				lastWasSpace = false ;
			}

			currentWidth += charWidthFn( strArray[ end ] ) ;

			if ( currentWidth > lineWidth ) {
				// If lastEnd === start, this is a word that takes the whole line: cut it
				// If not, use the lastEnd
				trimNewLine = true ;

				if ( lastEnd !== start ) {
					end = lastEnd ;
				}
				else if ( lineWidth < options.width ) {
					// This is the first line with an offset, so just start over in line two
					end = start ;
					return '' ;
				}

				currentLine = strArray.slice( start , end ).join( '' ) ;

				if ( options.fill ) {
					currentLine += ' '.repeat( lineWidth - lastWidth ) ;
				}

				return currentLine ;
			}

			// Do not move that inside the for(;;), some part are using a continue statement and manage the end value by themself
			end ++ ;
		}
	} ;

	while ( start < length && ( line = getNextLine() ) !== null ) {
		lines.push( line ) ;
		start = end ;
		lineWidth = options.width ;
	}

	// If it ends with an explicit newline, we have to reproduce it now!
	if ( explicitNewLine ) { lines.push( '' ) ; }

	if ( ! options.noTrim && ! options.fill ) {
		lines = lines.map( ( line_ , index ) => index === lines.length - 1 ? line_ : line_.trimRight() ) ;
	}

	if ( ! options.noJoin ) { lines = lines.join( options.glue ) ; }

	if ( options.updateOffset ) { options.offset = currentWidth ; }

	return lines ;
} ;


},{"./unicode.js":36}],38:[function(require,module,exports){
/*
	Tree Kit

	Copyright (c) 2014 - 2021 Cédric Ronvel

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



// Mimic Array's prototype methods, like Array#map(), Array#filter(), and so on...

exports.map = function( object , fn ) {
	if ( ! object || typeof object !== 'object' ) { throw new Error( "Expecting an object" ) ; }
	return Object.fromEntries( Object.entries( object ).map(   entry => [ entry[ 0 ] , fn( entry[ 1 ] ) ]   ) ) ;
} ;

exports.filter = function( object , fn ) {
	if ( ! object || typeof object !== 'object' ) { throw new Error( "Expecting an object" ) ; }
	return Object.fromEntries( Object.entries( object ).filter(   entry => fn( entry[ 1 ] )   ) ) ;
} ;


},{}],39:[function(require,module,exports){
/*
	Tree Kit

	Copyright (c) 2014 - 2021 Cédric Ronvel

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



/*
	Stand-alone fork of extend.js, without options.
*/

function clone( originalObject , circular ) {
	// First create an empty object with
	// same prototype of our original source

	var originalProto = Object.getPrototypeOf( originalObject ) ;

	// Opaque objects, like Date
	if ( clone.opaque.has( originalProto ) ) { return clone.opaque.get( originalProto )( originalObject ) ; }

	var propertyIndex , descriptor , keys , current , nextSource , proto ,
		copies = [ {
			source: originalObject ,
			target: Array.isArray( originalObject ) ? [] : Object.create( originalProto )
		} ] ,
		cloneObject = copies[ 0 ].target ,
		refMap = new Map() ;

	refMap.set( originalObject , cloneObject ) ;


	// First in, first out
	while ( ( current = copies.shift() ) ) {
		keys = Object.getOwnPropertyNames( current.source ) ;

		for ( propertyIndex = 0 ; propertyIndex < keys.length ; propertyIndex ++ ) {
			// Save the source's descriptor
			descriptor = Object.getOwnPropertyDescriptor( current.source , keys[ propertyIndex ] ) ;


			if ( ! descriptor.value || typeof descriptor.value !== 'object' ) {
				Object.defineProperty( current.target , keys[ propertyIndex ] , descriptor ) ;
				continue ;
			}

			nextSource = descriptor.value ;

			if ( circular ) {
				if ( refMap.has( nextSource ) ) {
					// The source is already referenced, just assign reference
					descriptor.value = refMap.get( nextSource ) ;
					Object.defineProperty( current.target , keys[ propertyIndex ] , descriptor ) ;
					continue ;
				}
			}

			proto = Object.getPrototypeOf( descriptor.value ) ;

			// Opaque objects, like Date, not recursivity for them
			if ( clone.opaque.has( proto ) ) {
				descriptor.value = clone.opaque.get( proto )( descriptor.value ) ;
				Object.defineProperty( current.target , keys[ propertyIndex ] , descriptor ) ;
				continue ;
			}

			descriptor.value = Array.isArray( nextSource ) ? [] : Object.create( proto ) ;

			if ( circular ) { refMap.set( nextSource , descriptor.value ) ; }

			Object.defineProperty( current.target , keys[ propertyIndex ] , descriptor ) ;
			copies.push( { source: nextSource , target: descriptor.value } ) ;
		}
	}

	return cloneObject ;
}

module.exports = clone ;



clone.opaque = new Map() ;
clone.opaque.set( Date.prototype , src => new Date( src ) ) ;


},{}],40:[function(require,module,exports){
/*
	Tree Kit

	Copyright (c) 2014 - 2021 Cédric Ronvel

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



/*
	== Diff function ==
*/

function diff( left , right , options ) {
	var i , key , keyPath ,
		leftKeys , rightKeys , leftTypeof , rightTypeof ,
		depth , diffObject , length , arrayMode ;

	leftTypeof = typeof left ;
	rightTypeof = typeof right ;

	if (
		! left || ( leftTypeof !== 'object' && leftTypeof !== 'function' ) ||
		! right || ( rightTypeof !== 'object' && rightTypeof !== 'function' )
	) {
		throw new Error( '[tree] diff() needs objects as argument #0 and #1' ) ;
	}

	if ( ! options || typeof options !== 'object' ) { options = {} ; }

	depth = options.depth || 0 ;

	// Things applied only for the root, not for recursive call
	if ( ! depth ) {
		options.diffObject = {} ;
		if ( ! options.path ) { options.path = '' ; }
		if ( ! options.pathSeparator ) { options.pathSeparator = '.' ; }
	}

	diffObject = options.diffObject ;


	// Left part
	if ( Array.isArray( left ) ) {
		arrayMode = true ;
		length = left.length ;
	}
	else {
		arrayMode = false ;
		leftKeys = Object.keys( left ) ;
		length = leftKeys.length ;
	}

	for ( i = 0 ; i < length ; i ++ ) {
		key = arrayMode ? i : leftKeys[ i ] ;
		keyPath = options.path + options.pathSeparator + key ;
		//console.log( 'L keyPath:' , keyPath ) ;

		if ( ! Object.hasOwn( right , key ) ) {
			diffObject[ keyPath ] = { path: keyPath , message: 'does not exist in right-hand side' } ;
			continue ;
		}

		leftTypeof = typeof left[ key ] ;
		rightTypeof = typeof right[ key ] ;

		if ( leftTypeof !== rightTypeof ) {
			diffObject[ keyPath ] = { path: keyPath , message: 'different typeof: ' + leftTypeof + ' - ' + rightTypeof } ;
			continue ;
		}

		if ( leftTypeof === 'object' || leftTypeof === 'function' ) {
			// Cleanup the 'null is an object' mess
			if ( ! left[ key ] ) {
				if ( right[ key ] ) { diffObject[ keyPath ] = { path: keyPath , message: 'different type: null - Object' } ; }
				continue ;
			}

			if ( ! right[ key ] ) {
				diffObject[ keyPath ] = { path: keyPath , message: 'different type: Object - null' } ;
				continue ;
			}

			if ( Array.isArray( left[ key ] ) && ! Array.isArray( right[ key ] ) ) {
				diffObject[ keyPath ] = { path: keyPath , message: 'different type: Array - Object' } ;
				continue ;
			}

			if ( ! Array.isArray( left[ key ] ) && Array.isArray( right[ key ] ) ) {
				diffObject[ keyPath ] = { path: keyPath , message: 'different type: Object - Array' } ;
				continue ;
			}

			diff( left[ key ] , right[ key ] , {
				path: keyPath , pathSeparator: options.pathSeparator , depth: depth + 1 , diffObject: diffObject
			} ) ;
			continue ;
		}

		if ( left[ key ] !== right[ key ] ) {
			diffObject[ keyPath ] = { path: keyPath , message: 'different value: ' + left[ key ] + ' - ' + right[ key ] } ;
			continue ;
		}
	}


	// Right part
	if ( Array.isArray( right ) ) {
		arrayMode = true ;
		length = right.length ;
	}
	else {
		arrayMode = false ;
		rightKeys = Object.keys( right ) ;
		length = rightKeys.length ;
	}

	for ( i = 0 ; i < length ; i ++ ) {
		key = arrayMode ? i : rightKeys[ i ] ;
		keyPath = options.path + options.pathSeparator + key ;
		//console.log( 'R keyPath:' , keyPath ) ;

		if ( ! Object.hasOwn( left , key ) ) {
			diffObject[ keyPath ] = { path: keyPath , message: 'does not exist in left-hand side' } ;
			continue ;
		}
	}

	return Object.keys( diffObject ).length ? diffObject : null ;
}

exports.diff = diff ;


},{}],41:[function(require,module,exports){
/*
	Tree Kit

	Copyright (c) 2014 - 2021 Cédric Ronvel

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



const dotPath = {} ;
module.exports = dotPath ;



const EMPTY_PATH = [] ;
const PROTO_POLLUTION_MESSAGE = 'This would cause prototype pollution' ;



function toPathArray( path ) {
	if ( Array.isArray( path ) ) {
		/*
		let i , iMax = path.length ;
		for ( i = 0 ; i < iMax ; i ++ ) {
			if ( typeof path[ i ] !== 'string' || typeof path[ i ] !== 'number' ) { path[ i ] = '' + path[ i ] ; }
		}
		//*/
		return path ;
	}

	if ( ! path ) { return EMPTY_PATH ; }
	if ( typeof path === 'string' ) {
		return path[ path.length - 1 ] === '.' ? path.slice( 0 , - 1 ).split( '.' ) : path.split( '.' ) ;
	}

	throw new TypeError( '[tree.dotPath]: the path argument should be a string or an array' ) ;
}

// Expose toPathArray()
dotPath.toPathArray = toPathArray ;



// Walk the tree using the path array.
function walk( object , pathArray , maxOffset = 0 ) {
	var index , indexMax , key ,
		pointer = object ;

	for ( index = 0 , indexMax = pathArray.length + maxOffset ; index < indexMax ; index ++ ) {
		key = pathArray[ index ] ;

		if ( typeof key === 'object' || key === '__proto__' || typeof pointer === 'function' ) { throw new Error( PROTO_POLLUTION_MESSAGE ) ; }
		if ( ! pointer || typeof pointer !== 'object' ) { return undefined ; }

		pointer = pointer[ key ] ;
	}

	return pointer ;
}



// Walk the tree, create missing element: pave the path up to before the last part of the path.
// Return that before-the-last element.
// Object MUST be an object! no check are performed for the first step!
function pave( object , pathArray ) {
	var index , indexMax , key ,
		pointer = object ;

	for ( index = 0 , indexMax = pathArray.length - 1 ; index < indexMax ; index ++ ) {
		key = pathArray[ index ] ;

		if ( typeof key === 'object' || key === '__proto__' || typeof pointer[ key ] === 'function' ) { throw new Error( PROTO_POLLUTION_MESSAGE ) ; }
		if ( ! pointer[ key ] || typeof pointer[ key ] !== 'object' ) { pointer[ key ] = {} ; }

		pointer = pointer[ key ] ;
	}

	return pointer ;
}



dotPath.get = ( object , path ) => walk( object , toPathArray( path ) ) ;



dotPath.set = ( object , path , value ) => {
	if ( ! object || typeof object !== 'object' ) { return ; }

	var pathArray = toPathArray( path ) ,
		key = pathArray[ pathArray.length - 1 ] ;

	if ( typeof key === 'object' || key === '__proto__' ) { throw new Error( PROTO_POLLUTION_MESSAGE ) ; }

	var pointer = pave( object , pathArray ) ;

	pointer[ key ] = value ;

	return value ;
} ;



dotPath.define = ( object , path , value ) => {
	if ( ! object || typeof object !== 'object' ) { return ; }

	var pathArray = toPathArray( path ) ,
		key = pathArray[ pathArray.length - 1 ] ;

	if ( typeof key === 'object' || key === '__proto__' ) { throw new Error( PROTO_POLLUTION_MESSAGE ) ; }

	var pointer = pave( object , pathArray ) ;

	if ( ! ( key in pointer ) ) { pointer[ key ] = value ; }

	return pointer[ key ] ;
} ;



dotPath.inc = ( object , path ) => {
	if ( ! object || typeof object !== 'object' ) { return ; }

	var pathArray = toPathArray( path ) ,
		key = pathArray[ pathArray.length - 1 ] ;

	if ( typeof key === 'object' || key === '__proto__' ) { throw new Error( PROTO_POLLUTION_MESSAGE ) ; }

	var pointer = pave( object , pathArray ) ;

	if ( typeof pointer[ key ] === 'number' ) { pointer[ key ] ++ ; }
	else if ( ! pointer[ key ] || typeof pointer[ key ] !== 'object' ) { pointer[ key ] = 1 ; }

	return pointer[ key ] ;
} ;



dotPath.dec = ( object , path ) => {
	if ( ! object || typeof object !== 'object' ) { return ; }

	var pathArray = toPathArray( path ) ,
		key = pathArray[ pathArray.length - 1 ] ;

	if ( typeof key === 'object' || key === '__proto__' ) { throw new Error( PROTO_POLLUTION_MESSAGE ) ; }

	var pointer = pave( object , pathArray ) ;

	if ( typeof pointer[ key ] === 'number' ) { pointer[ key ] -- ; }
	else if ( ! pointer[ key ] || typeof pointer[ key ] !== 'object' ) { pointer[ key ] = - 1 ; }

	return pointer[ key ] ;
} ;



dotPath.concat = ( object , path , value ) => {
	if ( ! object || typeof object !== 'object' ) { return ; }

	var pathArray = toPathArray( path ) ,
		key = pathArray[ pathArray.length - 1 ] ;

	if ( typeof key === 'object' || key === '__proto__' ) { throw new Error( PROTO_POLLUTION_MESSAGE ) ; }

	var pointer = pave( object , pathArray ) ;

	if ( ! pointer[ key ] ) { pointer[ key ] = value ; }
	else if ( Array.isArray( pointer[ key ] ) && Array.isArray( value ) ) {
		pointer[ key ] = pointer[ key ].concat( value ) ;
	}
	//else ? do nothing???

	return pointer[ key ] ;
} ;



dotPath.insert = ( object , path , value ) => {
	if ( ! object || typeof object !== 'object' ) { return ; }

	var pathArray = toPathArray( path ) ,
		key = pathArray[ pathArray.length - 1 ] ;

	if ( typeof key === 'object' || key === '__proto__' ) { throw new Error( PROTO_POLLUTION_MESSAGE ) ; }

	var pointer = pave( object , pathArray ) ;

	if ( ! pointer[ key ] ) { pointer[ key ] = value ; }
	else if ( Array.isArray( pointer[ key ] ) && Array.isArray( value ) ) {
		pointer[ key ] = value.concat( pointer[ key ] ) ;
	}
	//else ? do nothing???

	return pointer[ key ] ;
} ;



dotPath.delete = ( object , path ) => {
	var pathArray = toPathArray( path ) ,
		key = pathArray[ pathArray.length - 1 ] ;

	if ( typeof key === 'object' || key === '__proto__' ) { throw new Error( PROTO_POLLUTION_MESSAGE ) ; }

	var pointer = walk( object , pathArray , - 1 ) ;

	if ( ! pointer || typeof pointer !== 'object' || ! Object.hasOwn( pointer , key ) ) { return false ; }

	delete pointer[ key ] ;

	return true ;
} ;



dotPath.autoPush = ( object , path , value ) => {
	if ( ! object || typeof object !== 'object' ) { return ; }

	var pathArray = toPathArray( path ) ,
		key = pathArray[ pathArray.length - 1 ] ;

	if ( typeof key === 'object' || key === '__proto__' ) { throw new Error( PROTO_POLLUTION_MESSAGE ) ; }

	var pointer = pave( object , pathArray ) ;

	if ( pointer[ key ] === undefined ) { pointer[ key ] = value ; }
	else if ( Array.isArray( pointer[ key ] ) ) { pointer[ key ].push( value ) ; }
	else { pointer[ key ] = [ pointer[ key ] , value ] ; }

	return pointer[ key ] ;
} ;



dotPath.append = ( object , path , value ) => {
	if ( ! object || typeof object !== 'object' ) { return ; }

	var pathArray = toPathArray( path ) ,
		key = pathArray[ pathArray.length - 1 ] ;

	if ( typeof key === 'object' || key === '__proto__' ) { throw new Error( PROTO_POLLUTION_MESSAGE ) ; }

	var pointer = pave( object , pathArray ) ;

	if ( ! pointer[ key ] ) { pointer[ key ] = [ value ] ; }
	else if ( Array.isArray( pointer[ key ] ) ) { pointer[ key ].push( value ) ; }
	//else ? do nothing???

	return pointer[ key ] ;
} ;



dotPath.prepend = ( object , path , value ) => {
	if ( ! object || typeof object !== 'object' ) { return ; }

	var pathArray = toPathArray( path ) ,
		key = pathArray[ pathArray.length - 1 ] ;

	if ( typeof key === 'object' || key === '__proto__' ) { throw new Error( PROTO_POLLUTION_MESSAGE ) ; }

	var pointer = pave( object , pathArray ) ;

	if ( ! pointer[ key ] ) { pointer[ key ] = [ value ] ; }
	else if ( Array.isArray( pointer[ key ] ) ) { pointer[ key ].unshift( value ) ; }
	//else ? do nothing???

	return pointer[ key ] ;
} ;


},{}],42:[function(require,module,exports){
/*
	Tree Kit

	Copyright (c) 2014 - 2021 Cédric Ronvel

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



/*
	== Extend function ==
*/

/*
	options:
		* own: only copy own properties that are enumerable
		* nonEnum: copy non-enumerable properties as well, works only with own:true
		* descriptor: preserve property's descriptor
		* deep: boolean/Array/Set, if true perform a deep (recursive) extend, if it is an Array/Set of prototypes, only deep-copy
			objects of those prototypes
			(it is a replacement for deepFilter.whitelist which was removed in Tree Kit 0.6).
		* immutables: an Array/Set of immutable object's prototypes that are filtered out for deep-copy
			(it is a replacement for deepFilter.blacklist which was removed in Tree Kit 0.6).
		* maxDepth: used in conjunction with deep, when max depth is reached an exception is raised, default to 100 when
			the 'circular' option is off, or default to null if 'circular' is on
		* circular: boolean, circular references reconnection
		* move: boolean, move properties to target (delete properties from the sources)
		* preserve: boolean, existing properties in the target object are not overwritten
		* mask: boolean or number, reverse of 'preserve', only update existing properties in the target, do not create new keys,
			if its a number, the mask effect is only effective for the Nth element.
			E.g: .extend( {mask:2} , {} , object1 , object2 )
			So object1 extends the empty object like, but object2 do not create new keys not present in object1.
			With mask:true or mask:1, the mask behavior would apply at step 1 too, when object1 would try to extend the empty object,
			and since an empty object has no key, nothing would change, and the whole extend would return an empty object.
		* nofunc: skip functions
		* deepFunc: in conjunction with 'deep', this will process sources functions like objects rather than
			copying/referencing them directly into the source, thus, the result will not be a function, it forces 'deep'
		* proto: try to clone objects with the right prototype, using Object.create() or mutating it with Object.setPrototypeOf(),
			it forces option 'own'.
		* inherit: rather than mutating target prototype for source prototype like the 'proto' option does, here it is
			the source itself that IS the prototype for the target. Force option 'own' and disable 'proto'.
		* skipRoot: the prototype of the target root object is NOT mutated only if this option is set.
		* flat: extend into the target top-level only, compose name with the path of the source, force 'deep',
			disable 'unflat', 'proto', 'inherit'
		* unflat: assume sources are in the 'flat' format, expand all properties deeply into the target, disable 'flat'
*/
function extend( options , target , ... sources ) {
	var i , source , newTarget = false , length = sources.length ;

	if ( ! length ) { return target ; }

	if ( ! options || typeof options !== 'object' ) { options = {} ; }

	var runtime = { depth: 0 , prefix: '' } ;

	if ( options.deep ) {
		if ( Array.isArray( options.deep ) ) { options.deep = new Set( options.deep ) ; }
		else if ( ! ( options.deep instanceof Set ) ) { options.deep = true ; }
	}

	if ( options.immutables ) {
		if ( Array.isArray( options.immutables ) ) { options.immutables = new Set( options.immutables ) ; }
		else if ( ! ( options.immutables instanceof Set ) ) { delete options.immutables ; }
	}

	if ( ! options.maxDepth && options.deep && ! options.circular ) { options.maxDepth = 100 ; }

	if ( options.deepFunc ) { options.deep = true ; }

	// 'flat' option force 'deep'
	if ( options.flat ) {
		options.deep = true ;
		options.proto = false ;
		options.inherit = false ;
		options.unflat = false ;
		if ( typeof options.flat !== 'string' ) { options.flat = '.' ; }
	}

	if ( options.unflat ) {
		options.deep = false ;
		options.proto = false ;
		options.inherit = false ;
		options.flat = false ;
		if ( typeof options.unflat !== 'string' ) { options.unflat = '.' ; }
	}

	// If the prototype is applied, only owned properties should be copied
	if ( options.inherit ) { options.own = true ; options.proto = false ; }
	else if ( options.proto ) { options.own = true ; }

	if ( ! target || ( typeof target !== 'object' && typeof target !== 'function' ) ) {
		newTarget = true ;
	}

	if ( ! options.skipRoot && ( options.inherit || options.proto ) ) {
		for ( i = length - 1 ; i >= 0 ; i -- ) {
			source = sources[ i ] ;
			if ( source && ( typeof source === 'object' || typeof source === 'function' ) ) {
				if ( options.inherit ) {
					if ( newTarget ) { target = Object.create( source ) ; }
					else { Object.setPrototypeOf( target , source ) ; }
				}
				else if ( options.proto ) {
					if ( newTarget ) { target = Object.create( Object.getPrototypeOf( source ) ) ; }
					else { Object.setPrototypeOf( target , Object.getPrototypeOf( source ) ) ; }
				}

				break ;
			}
		}
	}
	else if ( newTarget ) {
		target = {} ;
	}

	runtime.references = { sources: [] , targets: [] } ;

	for ( i = 0 ; i < length ; i ++ ) {
		source = sources[ i ] ;
		if ( ! source || ( typeof source !== 'object' && typeof source !== 'function' ) ) { continue ; }
		extendOne( runtime , options , target , source , options.mask <= i + 1 ) ;
	}

	return target ;
}

module.exports = extend ;



function extendOne( runtime , options , target , source , mask ) {
	var sourceKeys , sourceKey ;

	// Max depth check
	if ( options.maxDepth && runtime.depth > options.maxDepth ) {
		throw new Error( '[tree] extend(): max depth reached(' + options.maxDepth + ')' ) ;
	}


	if ( options.circular ) {
		runtime.references.sources.push( source ) ;
		runtime.references.targets.push( target ) ;
	}

	// 'unflat' mode computing
	if ( options.unflat && runtime.depth === 0 ) {
		for ( sourceKey in source ) {
			runtime.unflatKeys = sourceKey.split( options.unflat ) ;
			runtime.unflatIndex = 0 ;
			runtime.unflatFullKey = sourceKey ;
			extendOneKV( runtime , options , target , source , runtime.unflatKeys[ runtime.unflatIndex ] , mask ) ;
		}

		delete runtime.unflatKeys ;
		delete runtime.unflatIndex ;
		delete runtime.unflatFullKey ;
	}
	else if ( options.own ) {
		if ( options.nonEnum ) { sourceKeys = Object.getOwnPropertyNames( source ) ; }
		else { sourceKeys = Object.keys( source ) ; }

		for ( sourceKey of sourceKeys ) {
			extendOneKV( runtime , options , target , source , sourceKey , mask ) ;
		}
	}
	else {
		for ( sourceKey in source ) {
			extendOneKV( runtime , options , target , source , sourceKey , mask ) ;
		}
	}
}



function extendOneKV( runtime , options , target , source , sourceKey , mask ) {
	// OMG, this DEPRECATED __proto__ shit is still alive and can be used to hack anything ><
	if ( sourceKey === '__proto__' ) { return ; }

	let sourceValue , sourceDescriptor , sourceValueProto ;

	if ( runtime.unflatKeys ) {
		if ( runtime.unflatIndex < runtime.unflatKeys.length - 1 ) {
			sourceValue = {} ;
		}
		else {
			sourceValue = source[ runtime.unflatFullKey ] ;
		}
	}
	else if ( options.descriptor ) {
		// If descriptor is on, get it now
		sourceDescriptor = Object.getOwnPropertyDescriptor( source , sourceKey ) ;
		sourceValue = sourceDescriptor.value ;
	}
	else {
		// We have to trigger an eventual getter only once
		sourceValue = source[ sourceKey ] ;
	}

	let targetKey = runtime.prefix + sourceKey ;

	// Do not copy if property is a function and we don't want them
	if ( options.nofunc && typeof sourceValue === 'function' ) { return ; }

	// Again, trigger an eventual getter only once
	let targetValue = target[ targetKey ] ;
	let targetValueIsObject = targetValue && ( typeof targetValue === 'object' || typeof targetValue === 'function' ) ;
	let sourceValueIsObject = sourceValue && ( typeof sourceValue === 'object' || typeof sourceValue === 'function' ) ;

	if (
		( options.deep || runtime.unflatKeys )
		&& sourceValue
		&& ( typeof sourceValue === 'object' || ( options.deepFunc && typeof sourceValue === 'function' ) )
		&& ( ! options.descriptor || ! sourceDescriptor.get )
		// not a condition we just cache sourceValueProto now... ok it's trashy ><
		&& ( ( sourceValueProto = Object.getPrototypeOf( sourceValue ) ) || true )
		&& ( ! ( options.deep instanceof Set ) || options.deep.has( sourceValueProto ) )
		&& ( ! options.immutables || ! options.immutables.has( sourceValueProto ) )
		&& ( ! options.preserve || targetValueIsObject )
		&& ( ! mask || targetValueIsObject )
	) {
		let indexOfSource = options.circular ? runtime.references.sources.indexOf( sourceValue ) : - 1 ;

		if ( options.flat ) {
			// No circular references reconnection when in 'flat' mode
			if ( indexOfSource >= 0 ) { return ; }

			extendOne(
				{
					depth: runtime.depth + 1 ,
					prefix: runtime.prefix + sourceKey + options.flat ,
					references: runtime.references
				} ,
				options , target , sourceValue , mask
			) ;
		}
		else {
			if ( indexOfSource >= 0 ) {
				// Circular references reconnection...
				targetValue = runtime.references.targets[ indexOfSource ] ;

				if ( options.descriptor ) {
					Object.defineProperty( target , targetKey , {
						value: targetValue ,
						enumerable: sourceDescriptor.enumerable ,
						writable: sourceDescriptor.writable ,
						configurable: sourceDescriptor.configurable
					} ) ;
				}
				else {
					target[ targetKey ] = targetValue ;
				}

				return ;
			}

			if ( ! targetValueIsObject || ! Object.hasOwn( target , targetKey ) ) {
				if ( Array.isArray( sourceValue ) ) { targetValue = [] ; }
				else if ( options.proto ) { targetValue = Object.create( sourceValueProto ) ; }
				else if ( options.inherit ) { targetValue = Object.create( sourceValue ) ; }
				else { targetValue = {} ; }

				if ( options.descriptor ) {
					Object.defineProperty( target , targetKey , {
						value: targetValue ,
						enumerable: sourceDescriptor.enumerable ,
						writable: sourceDescriptor.writable ,
						configurable: sourceDescriptor.configurable
					} ) ;
				}
				else {
					target[ targetKey ] = targetValue ;
				}
			}
			else if ( options.proto && Object.getPrototypeOf( targetValue ) !== sourceValueProto ) {
				Object.setPrototypeOf( targetValue , sourceValueProto ) ;
			}
			else if ( options.inherit && Object.getPrototypeOf( targetValue ) !== sourceValue ) {
				Object.setPrototypeOf( targetValue , sourceValue ) ;
			}

			if ( options.circular ) {
				runtime.references.sources.push( sourceValue ) ;
				runtime.references.targets.push( targetValue ) ;
			}

			if ( runtime.unflatKeys && runtime.unflatIndex < runtime.unflatKeys.length - 1 ) {
				// Finish unflatting this property
				let nextSourceKey = runtime.unflatKeys[ runtime.unflatIndex + 1 ] ;

				extendOneKV(
					{
						depth: runtime.depth ,	// keep the same depth
						unflatKeys: runtime.unflatKeys ,
						unflatIndex: runtime.unflatIndex + 1 ,
						unflatFullKey: runtime.unflatFullKey ,
						prefix: '' ,
						references: runtime.references
					} ,
					options , targetValue , source , nextSourceKey , mask
				) ;
			}
			else {
				// Recursively extends sub-object
				extendOne(
					{
						depth: runtime.depth + 1 ,
						prefix: '' ,
						references: runtime.references
					} ,
					options , targetValue , sourceValue , mask
				) ;
			}
		}
	}
	else if ( mask && ( targetValue === undefined || targetValueIsObject || sourceValueIsObject ) ) {
		// Do not create new value, and so do not delete source's properties that were not moved.
		// We also do not overwrite object with non-object, and we don't overwrite non-object with object (preserve hierarchy)
		return ;
	}
	else if ( options.preserve && targetValue !== undefined ) {
		// Do not overwrite, and so do not delete source's properties that were not moved
		return ;
	}
	else if ( ! options.inherit ) {
		if ( options.descriptor ) { Object.defineProperty( target , targetKey , sourceDescriptor ) ; }
		else { target[ targetKey ] = targetValue = sourceValue ; }
	}

	// Delete owned property of the source object
	if ( options.move ) { delete source[ sourceKey ] ; }
}


},{}],43:[function(require,module,exports){
/*
	Tree Kit

	Copyright (c) 2014 - 2021 Cédric Ronvel

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



/*
	DEPRECATED, moved to its own module: lazyness
*/

exports.defineLazyProperty = function defineLazyProperty( object , name , func ) {
	Object.defineProperty( object , name , {
		configurable: true ,
		enumerable: true ,
		get: function() {

			var value = func() ;

			Object.defineProperty( object , name , {
				configurable: true ,
				enumerable: true ,
				writable: false ,
				value: value
			} ) ;

			return value ;
		}
	} ) ;
} ;


},{}],44:[function(require,module,exports){
/*
	Tree Kit

	Copyright (c) 2014 - 2021 Cédric Ronvel

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



const tree = require( './tree.js' ) ;
const util = require( 'util' ) ;



// Create and export
const masklib = {} ;
module.exports = masklib ;



/*
	== Mask-family class ==

	Recursively select values in the input object if the same path in the mask object is set.
*/

/*
	TODO:
	- negative mask
	- constraint check
	- Maskable object, like in csk-php
*/

masklib.Mask = function Mask() {
	throw new Error( 'Cannot create a tree.Mask() directly' ) ;
} ;



const maskDefaultOptions = {
	clone: false ,
	path: '<object>' ,
	pathSeparator: '.'
} ;



/*
	options:
		clone: the output clone the input rather than reference it
		pathSeperator: when expressing path, this is the separator
		leaf: a callback to exec for each mask leaf
		node? a callback to exec for each mask node
*/
masklib.createMask = function createMask( maskArgument , options ) {
	if ( maskArgument === null || typeof maskArgument !== 'object' ) {
		throw new TypeError( '[tree] .createMask() : Argument #1 should be an object' ) ;
	}

	if ( options !== null && typeof options === 'object' ) { options = tree.extend( null , {} , maskDefaultOptions , options ) ; }
	else { options = maskDefaultOptions ; }

	var mask = Object.create( masklib.Mask.prototype , {
		__options__: { value: options , writable: true  }
	} ) ;

	tree.extend( null , mask , maskArgument ) ;

	return mask ;
} ;



// Apply the mask to an input tree
masklib.Mask.prototype.applyTo = function applyTo( input , context , contextOverideDefault ) {
	// Arguments checking
	if ( input === null || typeof input !== 'object' ) {
		throw new TypeError( '[tree] .applyTo() : Argument #1 should be an object' ) ;
	}

	if ( contextOverideDefault ) {
		context = tree.extend( null ,
			{
				mask: this ,
				options: this.__options__ ,
				path: this.__options__.path
			} ,
			context
		) ;
	}
	else if ( context === undefined ) {
		context = {
			mask: this ,
			options: this.__options__ ,
			path: this.__options__.path
		} ;
	}


	// Init
	//console.log( context ) ;
	var result , nextPath , output ,
		i , key , maskValue ,
		maskKeyList = Object.keys( context.mask ) ,
		j , inputKey , inputValue , inputKeyList ;

	if ( Array.isArray( input ) ) { output = [] ; }
	else { output = {} ; }


	// Iterate through mask properties
	for ( i = 0 ; i < maskKeyList.length ; i ++ ) {
		key = maskKeyList[ i ] ;
		maskValue = context.mask[ key ] ;

		//console.log( '\nnext loop: ' , key , maskValue ) ;

		// The special key * is a wildcard, it match everything
		if ( key === '*' ) {
			//console.log( 'wildcard' ) ;
			inputKeyList = Object.keys( input ) ;

			for ( j = 0 ; j < inputKeyList.length ; j ++ ) {
				inputKey = inputKeyList[ j ] ;
				inputValue = input[ inputKey ] ;

				//console.log( '*: ' , inputKey ) ;
				nextPath = context.path + context.options.pathSeparator + inputKey ;

				// If it is an array or object, recursively check it
				if ( maskValue !== null && typeof maskValue === 'object' ) {
					if ( inputValue !== null && typeof inputValue === 'object' ) {
						if ( inputValue instanceof masklib.Mask ) {
							output[ inputKey ] = inputValue.applyTo( inputValue , { path: nextPath } , true ) ;
						}
						else {
							output[ inputKey ] = this.applyTo( inputValue , tree.extend( null , {} , context , { mask: maskValue , path: nextPath } ) ) ;
						}
					}
					else if ( typeof context.options.leaf === 'function' ) {
						output[ inputKey ] = this.applyTo( {} , tree.extend( null , {} , context , { mask: maskValue , path: nextPath } ) ) ;
					}
				}
				else if ( maskValue !== null && typeof context.options.leaf === 'function' ) {
					//console.log( 'leaf callback' ) ;
					result = context.options.leaf( input , inputKey , maskValue , nextPath ) ;
					if ( ! ( result instanceof Error ) ) { output[ inputKey ] = result ; }
				}
				else if ( context.options.clone && ( inputValue !== null && typeof inputValue === 'object' ) ) {
					output[ inputKey ] = tree.extend( { deep: true } , {} , inputValue ) ;
				}
				else {
					output[ inputKey ] = inputValue ;
				}
			}

			continue ;
		}


		nextPath = context.path + context.options.pathSeparator + key ;

		// If it is an object, recursively check it
		//if ( maskValue instanceof masklib.Mask )
		if ( maskValue !== null && typeof maskValue === 'object' ) {
			//console.log( 'sub' ) ;

			if ( Object.hasOwn( input , key ) && input[ key ] !== null && typeof input[ key ] === 'object' ) {
				//console.log( 'recursive call' ) ;

				if ( input.key instanceof masklib.Mask ) {
					output[ key ] = input.key.applyTo( input[ key ] , { path: nextPath } , true ) ;
				}
				else {
					output[ key ] = this.applyTo( input[ key ] , tree.extend( null , {} , context , { mask: maskValue , path: nextPath } ) ) ;
				}
			}
			// recursive call only if there are callback
			else if ( context.options.leaf ) {
				//console.log( 'recursive call' ) ;
				output[ key ] = this.applyTo( {} , tree.extend( null , {} , context , { mask: maskValue , path: nextPath } ) ) ;
			}
		}
		// If mask exists, add the key
		else if ( Object.hasOwn( input , key ) ) {
			//console.log( 'property found' ) ;

			if ( maskValue !== undefined && typeof context.options.leaf === 'function' ) {
				//console.log( 'leaf callback' ) ;
				result = context.options.leaf( input , key , maskValue , nextPath ) ;
				if ( ! ( result instanceof Error ) ) { output[ key ] = result ; }
			}
			else if ( context.options.clone && ( input[ key ] !== null && typeof input[ key ] === 'object' ) ) {
				output[ key ] = tree.extend( { deep: true } , {} , input[ key ] ) ;
			}
			else {
				output[ key ] = input[ key ] ;
			}
		}
		else if ( maskValue !== undefined && typeof context.options.leaf === 'function' ) {
			//console.log( 'leaf callback' ) ;
			result = context.options.leaf( input , key , maskValue , nextPath ) ;
			if ( ! ( result instanceof Error ) ) { output[ key ] = result ; }
		}
	}

	return output ;
} ;



// InverseMask: create an output tree from the input, by excluding properties of the mask

masklib.InverseMask = function InverseMask() {
	throw new Error( 'Cannot create a tree.InverseMask() directly' ) ;
} ;

util.inherits( masklib.InverseMask , masklib.Mask ) ;



/*
	options:
		clone: the output clone the input rather than reference it
		pathSeperator: when expressing path, this is the separator
*/
masklib.createInverseMask = function createInverseMask( maskArgument , options ) {
	if ( maskArgument === null || typeof maskArgument !== 'object' ) {
		throw new TypeError( '[tree] .createInverseMask() : Argument #1 should be an object' ) ;
	}

	if ( options !== null && typeof options === 'object' ) { options = tree.extend( null , {} , maskDefaultOptions , options ) ; }
	else { options = maskDefaultOptions ; }

	var mask = Object.create( masklib.InverseMask.prototype , {
		__options__: { value: options , writable: true  }
	} ) ;

	tree.extend( null , mask , maskArgument ) ;

	return mask ;
} ;



// Apply the mask to an input tree
masklib.InverseMask.prototype.applyTo = function applyTo( input , context , contextOverideDefault ) {
	// Arguments checking
	if ( input === null || typeof input !== 'object' ) {
		throw new TypeError( '[tree] .applyTo() : Argument #1 should be an object' ) ;
	}

	if ( contextOverideDefault ) {
		context = tree.extend( null ,
			{
				mask: this ,
				options: this.__options__ ,
				path: this.__options__.path
			} ,
			context
		) ;
	}
	else if ( context === undefined ) {
		context = {
			mask: this ,
			options: this.__options__ ,
			path: this.__options__.path
		} ;
	}


	// Init
	//console.log( context ) ;
	var nextPath , output ,
		i , key , maskValue ,
		maskKeyList = Object.keys( context.mask ) ,
		j , inputKey , inputValue , inputKeyList ;

	if ( Array.isArray( input ) ) { output = tree.extend( { deep: true } , [] , input ) ; }
	else { output = tree.extend( { deep: true } , {} , input ) ; }

	//console.log( output ) ;

	// Iterate through mask properties
	for ( i = 0 ; i < maskKeyList.length ; i ++ ) {
		key = maskKeyList[ i ] ;
		maskValue = context.mask[ key ] ;

		//console.log( '\nnext loop: ' , key , maskValue ) ;

		// The special key * is a wildcard, it match everything
		if ( key === '*' ) {
			//console.log( 'wildcard' ) ;
			inputKeyList = Object.keys( input ) ;

			for ( j = 0 ; j < inputKeyList.length ; j ++ ) {
				inputKey = inputKeyList[ j ] ;
				inputValue = input[ inputKey ] ;

				//console.log( '*: ' , inputKey ) ;
				nextPath = context.path + context.options.pathSeparator + inputKey ;

				// If it is an array or object, recursively check it
				if ( maskValue !== null && typeof maskValue === 'object' ) {
					if ( inputValue !== null && typeof inputValue === 'object' ) {
						if ( inputValue instanceof masklib.Mask ) {
							output[ inputKey ] = inputValue.applyTo( inputValue , { path: nextPath } , true ) ;
						}
						else {
							output[ inputKey ] = this.applyTo( inputValue , tree.extend( null , {} , context , { mask: maskValue , path: nextPath } ) ) ;
						}
					}
				}
				else {
					delete output[ inputKey ] ;
				}
			}

			continue ;
		}


		nextPath = context.path + context.options.pathSeparator + key ;

		// If it is an object, recursively check it
		//if ( maskValue instanceof masklib.Mask )
		if ( maskValue !== null && typeof maskValue === 'object' ) {
			//console.log( 'sub' ) ;

			if ( Object.hasOwn( input , key ) && input[ key ] !== null && typeof input[ key ] === 'object' ) {
				//console.log( 'recursive call' ) ;

				if ( input.key instanceof masklib.Mask ) {
					output[ key ] = input.key.applyTo( input[ key ] , { path: nextPath } , true ) ;
				}
				else {
					output[ key ] = this.applyTo( input[ key ] , tree.extend( null , {} , context , { mask: maskValue , path: nextPath } ) ) ;
				}
			}
		}
		// If mask exists, remove the key
		else if ( Object.hasOwn( input , key ) ) {
			delete output[ key ] ;
		}
	}

	return output ;
} ;


},{"./tree.js":46,"util":79}],45:[function(require,module,exports){
/*
	Tree Kit

	Copyright (c) 2014 - 2021 Cédric Ronvel

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



const treePath = {} ;
module.exports = treePath ;



const PROTO_POLLUTION_MESSAGE = 'This would cause prototype pollution' ;



treePath.op = function( type , object , path , value ) {
	var i , parts , last , pointer , key , isArray = false , pathArrayMode = false , isGenericSet , canBeEmpty = true ;

	if ( ! object || typeof object !== 'object' ) { return ; }

	if ( typeof path === 'string' ) {
		// Split the path into parts
		if ( path ) { parts = path.match( /([.#[\]]|[^.#[\]]+)/g ) ; }
		else { parts = [ '' ] ; }

		if ( parts[ 0 ] === '.' ) { parts.unshift( '' ) ; }
		if ( parts[ parts.length - 1 ] === '.' ) { parts.push( '' ) ; }
	}
	else if ( Array.isArray( path ) ) {
		parts = path ;
		pathArrayMode = true ;
		/*
		for ( i = 0 ; i < parts.length ; i ++ ) {
			if ( typeof parts[ i ] !== 'string' || typeof parts[ i ] !== 'number' ) { parts[ i ] = '' + parts[ i ] ; }
		}
		//*/
	}
	else {
		throw new TypeError( '[tree.path] .' + type + '(): the path argument should be a string or an array' ) ;
	}

	switch ( type ) {
		case 'get' :
		case 'delete' :
			isGenericSet = false ;
			break ;
		case 'set' :
		case 'define' :
		case 'inc' :
		case 'dec' :
		case 'append' :
		case 'prepend' :
		case 'concat' :
		case 'insert' :
		case 'autoPush' :
			isGenericSet = true ;
			break ;
		default :
			throw new TypeError( "[tree.path] .op(): wrong type of operation '" + type + "'" ) ;
	}

	//console.log( parts ) ;
	// The pointer start at the object's root
	pointer = object ;

	last = parts.length - 1 ;

	for ( i = 0 ; i <= last ; i ++ ) {
		if ( pathArrayMode ) {
			if ( key === undefined ) {
				key = parts[ i ] ;
				if ( typeof key === 'object' || key === '__proto__' ) { throw new Error( PROTO_POLLUTION_MESSAGE ) ; }
				continue ;
			}

			if ( typeof pointer[ key ] === 'function' ) { throw new Error( PROTO_POLLUTION_MESSAGE ) ; }
			if ( ! pointer[ key ] || typeof pointer[ key ] !== 'object' ) {
				if ( ! isGenericSet ) { return undefined ; }
				pointer[ key ] = {} ;
			}

			pointer = pointer[ key ] ;
			key = parts[ i ] ;
			if ( typeof key === 'object' || key === '__proto__' ) { throw new Error( PROTO_POLLUTION_MESSAGE ) ; }
			continue ;
		}
		else if ( parts[ i ] === '.' ) {
			isArray = false ;

			if ( key === undefined ) {
				if ( ! canBeEmpty ) {
					canBeEmpty = true ;
					continue ;
				}

				key = '' ;
			}

			if ( typeof pointer[ key ] === 'function' ) { throw new Error( PROTO_POLLUTION_MESSAGE ) ; }
			if ( ! pointer[ key ] || typeof pointer[ key ] !== 'object' ) {
				if ( ! isGenericSet ) { return undefined ; }
				pointer[ key ] = {} ;
			}

			pointer = pointer[ key ] ;
			canBeEmpty = true ;

			continue ;
		}
		else if ( parts[ i ] === '#' || parts[ i ] === '[' ) {
			isArray = true ;
			canBeEmpty = false ;

			if ( key === undefined ) {
				// The root element cannot be altered, we are in trouble if an array is expected but we have only a regular object.
				if ( ! Array.isArray( pointer ) ) { return undefined ; }
				continue ;
			}

			if ( typeof pointer[ key ] === 'function' ) { throw new Error( PROTO_POLLUTION_MESSAGE ) ; }
			if ( ! pointer[ key ] || ! Array.isArray( pointer[ key ] ) ) {
				if ( ! isGenericSet ) { return undefined ; }
				pointer[ key ] = [] ;
			}

			pointer = pointer[ key ] ;

			continue ;
		}
		else if ( parts[ i ] === ']' ) {
			// Closing bracket: do nothing
			canBeEmpty = false ;
			continue ;
		}

		canBeEmpty = false ;

		if ( ! isArray ) {
			key = parts[ i ] ;
			if ( typeof key === 'object' || key === '__proto__' ) { throw new Error( PROTO_POLLUTION_MESSAGE ) ; }
			continue ;
		}

		switch ( parts[ i ] ) {
			case 'length' :
				key = 'length' ;
				break ;

			// Pseudo-key
			case 'first' :
				key = 0 ;
				break ;
			case 'last' :
				key = pointer.length - 1 ;
				if ( key < 0 ) { key = 0 ; }
				break ;
			case 'next' :
				if ( ! isGenericSet ) { return undefined ; }
				key = pointer.length ;
				break ;
			case 'insert' :
				if ( ! isGenericSet ) { return undefined ; }
				pointer.unshift( undefined ) ;
				key = 0 ;
				break ;

			// default = number
			default :
				// Convert the string key to a numerical index
				key = parseInt( parts[ i ] , 10 ) ;
		}
	}

	switch ( type ) {
		case 'get' :
			return pointer[ key ] ;
		case 'delete' :
			if ( isArray && typeof key === 'number' ) { pointer.splice( key , 1 ) ; }
			else { delete pointer[ key ] ; }
			return ;
		case 'set' :
			pointer[ key ] = value ;
			return pointer[ key ] ;
		case 'define' :
			// define: set only if it doesn't exist
			if ( ! ( key in pointer ) ) { pointer[ key ] = value ; }
			return pointer[ key ] ;
		case 'inc' :
			if ( typeof pointer[ key ] === 'number' ) { pointer[ key ] ++ ; }
			else if ( ! pointer[ key ] || typeof pointer[ key ] !== 'object' ) { pointer[ key ] = 1 ; }
			return pointer[ key ] ;
		case 'dec' :
			if ( typeof pointer[ key ] === 'number' ) { pointer[ key ] -- ; }
			else if ( ! pointer[ key ] || typeof pointer[ key ] !== 'object' ) { pointer[ key ] = - 1 ; }
			return pointer[ key ] ;
		case 'append' :
			if ( ! pointer[ key ] ) { pointer[ key ] = [ value ] ; }
			else if ( Array.isArray( pointer[ key ] ) ) { pointer[ key ].push( value ) ; }
			//else ? do nothing???
			return pointer[ key ] ;
		case 'prepend' :
			if ( ! pointer[ key ] ) { pointer[ key ] = [ value ] ; }
			else if ( Array.isArray( pointer[ key ] ) ) { pointer[ key ].unshift( value ) ; }
			//else ? do nothing???
			return pointer[ key ] ;
		case 'concat' :
			if ( ! pointer[ key ] ) { pointer[ key ] = value ; }
			else if ( Array.isArray( pointer[ key ] ) && Array.isArray( value ) ) {
				pointer[ key ] = pointer[ key ].concat( value ) ;
			}
			//else ? do nothing???
			return pointer[ key ] ;
		case 'insert' :
			if ( ! pointer[ key ] ) { pointer[ key ] = value ; }
			else if ( Array.isArray( pointer[ key ] ) && Array.isArray( value ) ) {
				pointer[ key ] = value.concat( pointer[ key ] ) ;
			}
			//else ? do nothing???
			return pointer[ key ] ;
		case 'autoPush' :
			if ( pointer[ key ] === undefined ) { pointer[ key ] = value ; }
			else if ( Array.isArray( pointer[ key ] ) ) { pointer[ key ].push( value ) ; }
			else { pointer[ key ] = [ pointer[ key ] , value ] ; }
			return pointer[ key ] ;
	}
} ;



// get, set and delete use the same op() function
treePath.get = treePath.op.bind( undefined , 'get' ) ;
treePath.delete = treePath.op.bind( undefined , 'delete' ) ;
treePath.set = treePath.op.bind( undefined , 'set' ) ;
treePath.define = treePath.op.bind( undefined , 'define' ) ;
treePath.inc = treePath.op.bind( undefined , 'inc' ) ;
treePath.dec = treePath.op.bind( undefined , 'dec' ) ;
treePath.append = treePath.op.bind( undefined , 'append' ) ;
treePath.prepend = treePath.op.bind( undefined , 'prepend' ) ;
treePath.concat = treePath.op.bind( undefined , 'concat' ) ;
treePath.insert = treePath.op.bind( undefined , 'insert' ) ;
treePath.autoPush = treePath.op.bind( undefined , 'autoPush' ) ;



// Prototype used for object creation, so they can be created with Object.create( tree.path.prototype )
treePath.prototype = {
	get: function( path ) { return treePath.get( this , path ) ; } ,
	delete: function( path ) { return treePath.delete( this , path ) ; } ,
	set: function( path , value ) { return treePath.set( this , path , value ) ; } ,
	define: function( path , value ) { return treePath.define( this , path , value ) ; } ,
	inc: function( path , value ) { return treePath.inc( this , path , value ) ; } ,
	dec: function( path , value ) { return treePath.dec( this , path , value ) ; } ,
	append: function( path , value ) { return treePath.append( this , path , value ) ; } ,
	prepend: function( path , value ) { return treePath.prepend( this , path , value ) ; } ,
	concat: function( path , value ) { return treePath.concat( this , path , value ) ; } ,
	insert: function( path , value ) { return treePath.insert( this , path , value ) ; } ,
	autoPush: function( path , value ) { return treePath.autoPush( this , path , value ) ; }
} ;



// Upgrade an object so it can support get, set and delete at its root
treePath.upgrade = function( object ) {
	Object.defineProperties( object , {
		get: { value: treePath.op.bind( undefined , 'get' , object ) } ,
		delete: { value: treePath.op.bind( undefined , 'delete' , object ) } ,
		set: { value: treePath.op.bind( undefined , 'set' , object ) } ,
		define: { value: treePath.op.bind( undefined , 'define' , object ) } ,
		inc: { value: treePath.op.bind( undefined , 'inc' , object ) } ,
		dec: { value: treePath.op.bind( undefined , 'dec' , object ) } ,
		append: { value: treePath.op.bind( undefined , 'append' , object ) } ,
		prepend: { value: treePath.op.bind( undefined , 'prepend' , object ) } ,
		concat: { value: treePath.op.bind( undefined , 'concat' , object ) } ,
		insert: { value: treePath.op.bind( undefined , 'insert' , object ) } ,
		autoPush: { value: treePath.op.bind( undefined , 'autoPush' , object ) }
	} ) ;
} ;


},{}],46:[function(require,module,exports){
/*
	Tree Kit

	Copyright (c) 2014 - 2021 Cédric Ronvel

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



const tree = {} ;
module.exports = tree ;



Object.assign( tree ,
	{
		extend: require( './extend.js' ) ,
		clone: require( './clone.js' ) ,
		path: require( './path.js' ) ,
		dotPath: require( './dotPath.js' ) ,
		wildDotPath: require( './wildDotPath.js' )
	} ,
	require( './lazy.js' ) ,
	require( './diff.js' ) ,
	require( './mask.js' ) ,
	require( './arrayLike.js' )
) ;


},{"./arrayLike.js":38,"./clone.js":39,"./diff.js":40,"./dotPath.js":41,"./extend.js":42,"./lazy.js":43,"./mask.js":44,"./path.js":45,"./wildDotPath.js":47}],47:[function(require,module,exports){
/*
	Tree Kit

	Copyright (c) 2014 - 2021 Cédric Ronvel

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



const wildDotPath = {} ;
module.exports = wildDotPath ;



const EMPTY_PATH = [] ;
const PROTO_POLLUTION_MESSAGE = 'This would cause prototype pollution' ;



function toPathArray( path ) {
	if ( Array.isArray( path ) ) {
		/*
		let i , iMax = path.length ;
		for ( i = 0 ; i < iMax ; i ++ ) {
			if ( typeof path[ i ] !== 'string' || typeof path[ i ] !== 'number' ) { path[ i ] = '' + path[ i ] ; }
		}
		//*/
		return path ;
	}

	if ( ! path ) { return EMPTY_PATH ; }
	if ( typeof path === 'string' ) {
		return path[ path.length - 1 ] === '.' ? path.slice( 0 , - 1 ).split( '.' ) : path.split( '.' ) ;
	}

	throw new TypeError( '[tree.wildDotPath]: the path argument should be a string or an array' ) ;
}

// Expose toPathArray()
wildDotPath.toPathArray = toPathArray ;



// Walk the tree and return an array of values.
function wildWalk( object , pathArray , maxOffset = 0 , index = 0 , result = [] ) {
	var indexMax , key ,
		pointer = object ;

	for ( indexMax = pathArray.length + maxOffset ; index < indexMax ; index ++ ) {
		key = pathArray[ index ] ;

		if ( typeof key === 'object' || key === '__proto__' || typeof pointer === 'function' ) { throw new Error( PROTO_POLLUTION_MESSAGE ) ; }
		if ( ! pointer || typeof pointer !== 'object' ) { return result ; }

		if ( key === '*' ) {
			for ( let subPointer of Array.isArray( pointer ) ? pointer : Object.values( pointer ) ) {
				wildWalk( subPointer , pathArray , maxOffset , index + 1 , result ) ;
			}

			return result ;
		}

		pointer = pointer[ key ] ;
	}

	result.push( pointer ) ;

	return result ;
}



const VALUE_LIST_MODE = 0 ;
const PATH_LIST_MODE = 1 ;
const PATH_VALUE_MAP_MODE = 2 ;

// Same than wildWalk, but either return an array of path, or an object of path => value.
function wildWalkPathValue( object , pathArray , resultMode , maxOffset = 0 , index = 0 , path = '' , result = null ) {
	if ( ! result ) {
		result = resultMode === PATH_VALUE_MAP_MODE ? {} : [] ;
	}

	var indexMax , key ,
		pointer = object ;

	for ( indexMax = pathArray.length + maxOffset ; index < indexMax ; index ++ ) {
		key = pathArray[ index ] ;

		if ( typeof key === 'object' || key === '__proto__' || typeof pointer === 'function' ) { throw new Error( PROTO_POLLUTION_MESSAGE ) ; }
		if ( ! pointer || typeof pointer !== 'object' ) { return result ; }

		if ( key === '*' ) {
			if ( Array.isArray( pointer ) ) {
				let subKey = 0 ;
				for ( let subPointer of pointer ) {
					wildWalkPathValue( subPointer , pathArray , resultMode , maxOffset , index + 1 , path ? path + '.' + subKey : '' + subKey , result ) ;
					subKey ++ ;
				}
			}
			else {
				for ( let [ subKey , subPointer ] of Object.entries( pointer ) ) {
					wildWalkPathValue( subPointer , pathArray , resultMode , maxOffset , index + 1 , path ? path + '.' + subKey : '' + subKey , result ) ;
				}
			}

			return result ;
		}

		path = path ? path + '.' + key : key ;
		pointer = pointer[ key ] ;
	}

	if ( resultMode === VALUE_LIST_MODE ) {
		result.push( pointer ) ;
	}
	else if ( resultMode === PATH_LIST_MODE ) {
		result.push( path ) ;
	}
	else if ( resultMode === PATH_VALUE_MAP_MODE ) {
		result[ path ] = pointer ;
	}

	return result ;
}



// Get with wildcard, return an array
wildDotPath.get = wildDotPath.getValues = ( object , path ) => wildWalk( object , toPathArray( path ) ) ;
wildDotPath.getPaths = ( object , path ) => wildWalkPathValue( object , toPathArray( path ) , PATH_LIST_MODE ) ;
wildDotPath.getPathValueMap = ( object , path ) => wildWalkPathValue( object , toPathArray( path ) , PATH_VALUE_MAP_MODE ) ;



// Walk and pave the tree and exec a hook at leaf.
// Object MUST be an object! no check are performed for the first step!
function wildWalkPave( object , pathArray , leafHookFn , leafHookArg , index = 0 ) {
	var indexMax , key ,
		pointer = object ;

	for ( indexMax = pathArray.length - 1 ; index < indexMax ; index ++ ) {
		key = pathArray[ index ] ;

		if ( typeof key === 'object' || key === '__proto__' || typeof pointer === 'function' ) { throw new Error( PROTO_POLLUTION_MESSAGE ) ; }
		if ( ! pointer || typeof pointer !== 'object' ) { return 0 ; }

		if ( key === '*' ) {
			let count = 0 ;

			for ( let subPointer of Array.isArray( pointer ) ? pointer : Object.values( pointer ) ) {
				count += wildWalkPave( subPointer , pathArray , leafHookFn , leafHookArg , index + 1 ) ;
			}

			return count ;
		}

		// Pave
		if ( ! pointer[ key ] || typeof pointer[ key ] !== 'object' ) { pointer[ key ] = {} ; }

		pointer = pointer[ key ] ;
	}

	// Last key of the path
	key = pathArray[ index ] ;

	if ( key === '*' ) {
		if ( ! pointer || typeof pointer !== 'object' ) { return 0 ; }

		let count = 0 ;

		if ( Array.isArray( pointer ) ) {
			for ( let subKey = 0 ; subKey < pointer.length ; subKey ++ ) {
				count += leafHookFn( pointer , subKey , leafHookArg ) ;
			}
		}
		else {
			for ( let subKey of Object.keys( pointer ) ) {
				count += leafHookFn( pointer , subKey , leafHookArg ) ;
			}
		}

		return count ;
	}

	return leafHookFn( pointer , key , leafHookArg ) ;
}



const SET_HOOK = ( pointer , key , value ) => {
	pointer[ key ] = value ;
	return 1 ;
} ;

wildDotPath.set = ( object , path , value ) => {
	if ( ! object || typeof object !== 'object' ) { return 0 ; }
	return wildWalkPave( object , toPathArray( path ) , SET_HOOK , value ) ;
} ;



const DEFINE_HOOK = ( pointer , key , value ) => {
	if ( key in pointer ) { return 0 ; }
	pointer[ key ] = value ;
	return 1 ;
} ;

wildDotPath.define = ( object , path , value ) => {
	if ( ! object || typeof object !== 'object' ) { return 0 ; }
	return wildWalkPave( object , toPathArray( path ) , DEFINE_HOOK , value ) ;
} ;



const INC_HOOK = ( pointer , key ) => {
	if ( typeof pointer[ key ] === 'number' ) { pointer[ key ] ++ ; }
	else if ( ! pointer[ key ] || typeof pointer[ key ] !== 'object' ) { pointer[ key ] = 1 ; }
	return 1 ;
} ;

wildDotPath.inc = ( object , path ) => {
	if ( ! object || typeof object !== 'object' ) { return 0 ; }
	return wildWalkPave( object , toPathArray( path ) , INC_HOOK ) ;
} ;



const DEC_HOOK = ( pointer , key ) => {
	if ( typeof pointer[ key ] === 'number' ) { pointer[ key ] -- ; }
	else if ( ! pointer[ key ] || typeof pointer[ key ] !== 'object' ) { pointer[ key ] = - 1 ; }
	return 1 ;
} ;

wildDotPath.dec = ( object , path ) => {
	if ( ! object || typeof object !== 'object' ) { return 0 ; }
	return wildWalkPave( object , toPathArray( path ) , DEC_HOOK ) ;
} ;



const CONCAT_HOOK = ( pointer , key , value ) => {
	if ( ! pointer[ key ] ) {
		pointer[ key ] = value ;
	}
	else if ( Array.isArray( pointer[ key ] ) && Array.isArray( value ) ) {
		pointer[ key ] = pointer[ key ].concat( value ) ;
	}

	return 1 ;
} ;

wildDotPath.concat = ( object , path , value ) => {
	if ( ! object || typeof object !== 'object' ) { return 0 ; }
	return wildWalkPave( object , toPathArray( path ) , CONCAT_HOOK , value ) ;
} ;



const INSERT_HOOK = ( pointer , key , value ) => {
	if ( ! pointer[ key ] ) {
		pointer[ key ] = value ;
	}
	else if ( Array.isArray( pointer[ key ] ) && Array.isArray( value ) ) {
		pointer[ key ] = value.concat( pointer[ key ] ) ;
	}

	return 1 ;
} ;

wildDotPath.insert = ( object , path , value ) => {
	if ( ! object || typeof object !== 'object' ) { return 0 ; }
	return wildWalkPave( object , toPathArray( path ) , INSERT_HOOK , value ) ;
} ;



const DELETE_HOOK = ( pointer , key ) => {
	if ( ! Object.hasOwn( pointer , key ) ) { return 0 ; }
	delete pointer[ key ] ;
	return 1 ;
} ;

wildDotPath.delete = ( object , path ) => {
	if ( ! object || typeof object !== 'object' ) { return 0 ; }
	return wildWalkPave( object , toPathArray( path ) , DELETE_HOOK ) ;
} ;



const AUTOPUSH_HOOK = ( pointer , key , value ) => {
	if ( pointer[ key ] === undefined ) { pointer[ key ] = value ; }
	else if ( Array.isArray( pointer[ key ] ) ) { pointer[ key ].push( value ) ; }
	else { pointer[ key ] = [ pointer[ key ] , value ] ; }

	return 1 ;
} ;

wildDotPath.autoPush = ( object , path , value ) => {
	if ( ! object || typeof object !== 'object' ) { return 0 ; }
	return wildWalkPave( object , toPathArray( path ) , AUTOPUSH_HOOK , value ) ;
} ;



const APPEND_HOOK = ( pointer , key , value ) => {
	if ( ! pointer[ key ] ) { pointer[ key ] = [ value ] ; }
	else if ( Array.isArray( pointer[ key ] ) ) { pointer[ key ].push( value ) ; }
	return 1 ;
} ;

wildDotPath.append = ( object , path , value ) => {
	if ( ! object || typeof object !== 'object' ) { return 0 ; }
	return wildWalkPave( object , toPathArray( path ) , APPEND_HOOK , value ) ;
} ;



const PREPEND_HOOK = ( pointer , key , value ) => {
	if ( ! pointer[ key ] ) { pointer[ key ] = [ value ] ; }
	else if ( Array.isArray( pointer[ key ] ) ) { pointer[ key ].unshift( value ) ; }
	return 1 ;
} ;

wildDotPath.prepend = ( object , path , value ) => {
	if ( ! object || typeof object !== 'object' ) { return 0 ; }
	return wildWalkPave( object , toPathArray( path ) , PREPEND_HOOK , value ) ;
} ;


},{}],48:[function(require,module,exports){
(function (global){(function (){
'use strict';

var possibleNames = [
	'BigInt64Array',
	'BigUint64Array',
	'Float32Array',
	'Float64Array',
	'Int16Array',
	'Int32Array',
	'Int8Array',
	'Uint16Array',
	'Uint32Array',
	'Uint8Array',
	'Uint8ClampedArray'
];

var g = typeof globalThis === 'undefined' ? global : globalThis;

module.exports = function availableTypedArrays() {
	var out = [];
	for (var i = 0; i < possibleNames.length; i++) {
		if (typeof g[possibleNames[i]] === 'function') {
			out[out.length] = possibleNames[i];
		}
	}
	return out;
};

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],49:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  var i
  for (i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}

},{}],50:[function(require,module,exports){
(function (Buffer){(function (){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = { __proto__: Uint8Array.prototype, foo: function () { return 42 } }
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species != null &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  if (ArrayBuffer.isView(value)) {
    return fromArrayLike(value)
  }

  if (value == null) {
    throw TypeError(
      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      'or Array-like Object. Received type ' + (typeof value)
    )
  }

  if (isInstance(value, ArrayBuffer) ||
      (value && isInstance(value.buffer, ArrayBuffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'number') {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    )
  }

  var valueOf = value.valueOf && value.valueOf()
  if (valueOf != null && valueOf !== value) {
    return Buffer.from(valueOf, encodingOrOffset, length)
  }

  var b = fromObject(value)
  if (b) return b

  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
      typeof value[Symbol.toPrimitive] === 'function') {
    return Buffer.from(
      value[Symbol.toPrimitive]('string'), encodingOrOffset, length
    )
  }

  throw new TypeError(
    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
    'or Array-like Object. Received type ' + (typeof value)
  )
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj.length !== undefined) {
    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      return createBuffer(0)
    }
    return fromArrayLike(obj)
  }

  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data)
  }
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true &&
    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
}

Buffer.compare = function compare (a, b) {
  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength)
  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength)
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    )
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (isInstance(buf, Uint8Array)) {
      buf = Buffer.from(buf)
    }
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
      'Received type ' + typeof string
    )
  }

  var len = string.length
  var mustMatch = (arguments.length > 2 && arguments[2] === true)
  if (!mustMatch && len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
        }
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim()
  if (this.length > max) str += ' ... '
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (isInstance(target, Uint8Array)) {
    target = Buffer.from(target, target.offset, target.byteLength)
  }
  if (!Buffer.isBuffer(target)) {
    throw new TypeError(
      'The "target" argument must be one of type Buffer or Uint8Array. ' +
      'Received type ' + (typeof target)
    )
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  var strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
        : (firstByte > 0xBF) ? 2
          : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (var i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : Buffer.from(val, encoding)
    var len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
// the `instanceof` check but they should be treated as of that type.
// See: https://github.com/feross/buffer/issues/166
function isInstance (obj, type) {
  return obj instanceof type ||
    (obj != null && obj.constructor != null && obj.constructor.name != null &&
      obj.constructor.name === type.name)
}
function numberIsNaN (obj) {
  // For IE11 support
  return obj !== obj // eslint-disable-line no-self-compare
}

}).call(this)}).call(this,require("buffer").Buffer)
},{"base64-js":49,"buffer":50,"ieee754":65}],51:[function(require,module,exports){
'use strict';

var GetIntrinsic = require('get-intrinsic');

var callBind = require('./');

var $indexOf = callBind(GetIntrinsic('String.prototype.indexOf'));

module.exports = function callBoundIntrinsic(name, allowMissing) {
	var intrinsic = GetIntrinsic(name, !!allowMissing);
	if (typeof intrinsic === 'function' && $indexOf(name, '.prototype.') > -1) {
		return callBind(intrinsic);
	}
	return intrinsic;
};

},{"./":52,"get-intrinsic":57}],52:[function(require,module,exports){
'use strict';

var bind = require('function-bind');
var GetIntrinsic = require('get-intrinsic');
var setFunctionLength = require('set-function-length');

var $TypeError = GetIntrinsic('%TypeError%');
var $apply = GetIntrinsic('%Function.prototype.apply%');
var $call = GetIntrinsic('%Function.prototype.call%');
var $reflectApply = GetIntrinsic('%Reflect.apply%', true) || bind.call($call, $apply);

var $defineProperty = GetIntrinsic('%Object.defineProperty%', true);
var $max = GetIntrinsic('%Math.max%');

if ($defineProperty) {
	try {
		$defineProperty({}, 'a', { value: 1 });
	} catch (e) {
		// IE 8 has a broken defineProperty
		$defineProperty = null;
	}
}

module.exports = function callBind(originalFunction) {
	if (typeof originalFunction !== 'function') {
		throw new $TypeError('a function is required');
	}
	var func = $reflectApply(bind, $call, arguments);
	return setFunctionLength(
		func,
		1 + $max(0, originalFunction.length - (arguments.length - 1)),
		true
	);
};

var applyBind = function applyBind() {
	return $reflectApply(bind, $apply, arguments);
};

if ($defineProperty) {
	$defineProperty(module.exports, 'apply', { value: applyBind });
} else {
	module.exports.apply = applyBind;
}

},{"function-bind":56,"get-intrinsic":57,"set-function-length":75}],53:[function(require,module,exports){
'use strict';

var hasPropertyDescriptors = require('has-property-descriptors')();

var GetIntrinsic = require('get-intrinsic');

var $defineProperty = hasPropertyDescriptors && GetIntrinsic('%Object.defineProperty%', true);
if ($defineProperty) {
	try {
		$defineProperty({}, 'a', { value: 1 });
	} catch (e) {
		// IE 8 has a broken defineProperty
		$defineProperty = false;
	}
}

var $SyntaxError = GetIntrinsic('%SyntaxError%');
var $TypeError = GetIntrinsic('%TypeError%');

var gopd = require('gopd');

/** @type {(obj: Record<PropertyKey, unknown>, property: PropertyKey, value: unknown, nonEnumerable?: boolean | null, nonWritable?: boolean | null, nonConfigurable?: boolean | null, loose?: boolean) => void} */
module.exports = function defineDataProperty(
	obj,
	property,
	value
) {
	if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) {
		throw new $TypeError('`obj` must be an object or a function`');
	}
	if (typeof property !== 'string' && typeof property !== 'symbol') {
		throw new $TypeError('`property` must be a string or a symbol`');
	}
	if (arguments.length > 3 && typeof arguments[3] !== 'boolean' && arguments[3] !== null) {
		throw new $TypeError('`nonEnumerable`, if provided, must be a boolean or null');
	}
	if (arguments.length > 4 && typeof arguments[4] !== 'boolean' && arguments[4] !== null) {
		throw new $TypeError('`nonWritable`, if provided, must be a boolean or null');
	}
	if (arguments.length > 5 && typeof arguments[5] !== 'boolean' && arguments[5] !== null) {
		throw new $TypeError('`nonConfigurable`, if provided, must be a boolean or null');
	}
	if (arguments.length > 6 && typeof arguments[6] !== 'boolean') {
		throw new $TypeError('`loose`, if provided, must be a boolean');
	}

	var nonEnumerable = arguments.length > 3 ? arguments[3] : null;
	var nonWritable = arguments.length > 4 ? arguments[4] : null;
	var nonConfigurable = arguments.length > 5 ? arguments[5] : null;
	var loose = arguments.length > 6 ? arguments[6] : false;

	/* @type {false | TypedPropertyDescriptor<unknown>} */
	var desc = !!gopd && gopd(obj, property);

	if ($defineProperty) {
		$defineProperty(obj, property, {
			configurable: nonConfigurable === null && desc ? desc.configurable : !nonConfigurable,
			enumerable: nonEnumerable === null && desc ? desc.enumerable : !nonEnumerable,
			value: value,
			writable: nonWritable === null && desc ? desc.writable : !nonWritable
		});
	} else if (loose || (!nonEnumerable && !nonWritable && !nonConfigurable)) {
		// must fall back to [[Set]], and was not explicitly asked to make non-enumerable, non-writable, or non-configurable
		obj[property] = value; // eslint-disable-line no-param-reassign
	} else {
		throw new $SyntaxError('This environment does not support defining a property as non-configurable, non-writable, or non-enumerable.');
	}
};

},{"get-intrinsic":57,"gopd":58,"has-property-descriptors":59}],54:[function(require,module,exports){
'use strict';

var isCallable = require('is-callable');

var toStr = Object.prototype.toString;
var hasOwnProperty = Object.prototype.hasOwnProperty;

var forEachArray = function forEachArray(array, iterator, receiver) {
    for (var i = 0, len = array.length; i < len; i++) {
        if (hasOwnProperty.call(array, i)) {
            if (receiver == null) {
                iterator(array[i], i, array);
            } else {
                iterator.call(receiver, array[i], i, array);
            }
        }
    }
};

var forEachString = function forEachString(string, iterator, receiver) {
    for (var i = 0, len = string.length; i < len; i++) {
        // no such thing as a sparse string.
        if (receiver == null) {
            iterator(string.charAt(i), i, string);
        } else {
            iterator.call(receiver, string.charAt(i), i, string);
        }
    }
};

var forEachObject = function forEachObject(object, iterator, receiver) {
    for (var k in object) {
        if (hasOwnProperty.call(object, k)) {
            if (receiver == null) {
                iterator(object[k], k, object);
            } else {
                iterator.call(receiver, object[k], k, object);
            }
        }
    }
};

var forEach = function forEach(list, iterator, thisArg) {
    if (!isCallable(iterator)) {
        throw new TypeError('iterator must be a function');
    }

    var receiver;
    if (arguments.length >= 3) {
        receiver = thisArg;
    }

    if (toStr.call(list) === '[object Array]') {
        forEachArray(list, iterator, receiver);
    } else if (typeof list === 'string') {
        forEachString(list, iterator, receiver);
    } else {
        forEachObject(list, iterator, receiver);
    }
};

module.exports = forEach;

},{"is-callable":69}],55:[function(require,module,exports){
'use strict';

/* eslint no-invalid-this: 1 */

var ERROR_MESSAGE = 'Function.prototype.bind called on incompatible ';
var toStr = Object.prototype.toString;
var max = Math.max;
var funcType = '[object Function]';

var concatty = function concatty(a, b) {
    var arr = [];

    for (var i = 0; i < a.length; i += 1) {
        arr[i] = a[i];
    }
    for (var j = 0; j < b.length; j += 1) {
        arr[j + a.length] = b[j];
    }

    return arr;
};

var slicy = function slicy(arrLike, offset) {
    var arr = [];
    for (var i = offset || 0, j = 0; i < arrLike.length; i += 1, j += 1) {
        arr[j] = arrLike[i];
    }
    return arr;
};

var joiny = function (arr, joiner) {
    var str = '';
    for (var i = 0; i < arr.length; i += 1) {
        str += arr[i];
        if (i + 1 < arr.length) {
            str += joiner;
        }
    }
    return str;
};

module.exports = function bind(that) {
    var target = this;
    if (typeof target !== 'function' || toStr.apply(target) !== funcType) {
        throw new TypeError(ERROR_MESSAGE + target);
    }
    var args = slicy(arguments, 1);

    var bound;
    var binder = function () {
        if (this instanceof bound) {
            var result = target.apply(
                this,
                concatty(args, arguments)
            );
            if (Object(result) === result) {
                return result;
            }
            return this;
        }
        return target.apply(
            that,
            concatty(args, arguments)
        );

    };

    var boundLength = max(0, target.length - args.length);
    var boundArgs = [];
    for (var i = 0; i < boundLength; i++) {
        boundArgs[i] = '$' + i;
    }

    bound = Function('binder', 'return function (' + joiny(boundArgs, ',') + '){ return binder.apply(this,arguments); }')(binder);

    if (target.prototype) {
        var Empty = function Empty() {};
        Empty.prototype = target.prototype;
        bound.prototype = new Empty();
        Empty.prototype = null;
    }

    return bound;
};

},{}],56:[function(require,module,exports){
'use strict';

var implementation = require('./implementation');

module.exports = Function.prototype.bind || implementation;

},{"./implementation":55}],57:[function(require,module,exports){
'use strict';

var undefined;

var $SyntaxError = SyntaxError;
var $Function = Function;
var $TypeError = TypeError;

// eslint-disable-next-line consistent-return
var getEvalledConstructor = function (expressionSyntax) {
	try {
		return $Function('"use strict"; return (' + expressionSyntax + ').constructor;')();
	} catch (e) {}
};

var $gOPD = Object.getOwnPropertyDescriptor;
if ($gOPD) {
	try {
		$gOPD({}, '');
	} catch (e) {
		$gOPD = null; // this is IE 8, which has a broken gOPD
	}
}

var throwTypeError = function () {
	throw new $TypeError();
};
var ThrowTypeError = $gOPD
	? (function () {
		try {
			// eslint-disable-next-line no-unused-expressions, no-caller, no-restricted-properties
			arguments.callee; // IE 8 does not throw here
			return throwTypeError;
		} catch (calleeThrows) {
			try {
				// IE 8 throws on Object.getOwnPropertyDescriptor(arguments, '')
				return $gOPD(arguments, 'callee').get;
			} catch (gOPDthrows) {
				return throwTypeError;
			}
		}
	}())
	: throwTypeError;

var hasSymbols = require('has-symbols')();
var hasProto = require('has-proto')();

var getProto = Object.getPrototypeOf || (
	hasProto
		? function (x) { return x.__proto__; } // eslint-disable-line no-proto
		: null
);

var needsEval = {};

var TypedArray = typeof Uint8Array === 'undefined' || !getProto ? undefined : getProto(Uint8Array);

var INTRINSICS = {
	'%AggregateError%': typeof AggregateError === 'undefined' ? undefined : AggregateError,
	'%Array%': Array,
	'%ArrayBuffer%': typeof ArrayBuffer === 'undefined' ? undefined : ArrayBuffer,
	'%ArrayIteratorPrototype%': hasSymbols && getProto ? getProto([][Symbol.iterator]()) : undefined,
	'%AsyncFromSyncIteratorPrototype%': undefined,
	'%AsyncFunction%': needsEval,
	'%AsyncGenerator%': needsEval,
	'%AsyncGeneratorFunction%': needsEval,
	'%AsyncIteratorPrototype%': needsEval,
	'%Atomics%': typeof Atomics === 'undefined' ? undefined : Atomics,
	'%BigInt%': typeof BigInt === 'undefined' ? undefined : BigInt,
	'%BigInt64Array%': typeof BigInt64Array === 'undefined' ? undefined : BigInt64Array,
	'%BigUint64Array%': typeof BigUint64Array === 'undefined' ? undefined : BigUint64Array,
	'%Boolean%': Boolean,
	'%DataView%': typeof DataView === 'undefined' ? undefined : DataView,
	'%Date%': Date,
	'%decodeURI%': decodeURI,
	'%decodeURIComponent%': decodeURIComponent,
	'%encodeURI%': encodeURI,
	'%encodeURIComponent%': encodeURIComponent,
	'%Error%': Error,
	'%eval%': eval, // eslint-disable-line no-eval
	'%EvalError%': EvalError,
	'%Float32Array%': typeof Float32Array === 'undefined' ? undefined : Float32Array,
	'%Float64Array%': typeof Float64Array === 'undefined' ? undefined : Float64Array,
	'%FinalizationRegistry%': typeof FinalizationRegistry === 'undefined' ? undefined : FinalizationRegistry,
	'%Function%': $Function,
	'%GeneratorFunction%': needsEval,
	'%Int8Array%': typeof Int8Array === 'undefined' ? undefined : Int8Array,
	'%Int16Array%': typeof Int16Array === 'undefined' ? undefined : Int16Array,
	'%Int32Array%': typeof Int32Array === 'undefined' ? undefined : Int32Array,
	'%isFinite%': isFinite,
	'%isNaN%': isNaN,
	'%IteratorPrototype%': hasSymbols && getProto ? getProto(getProto([][Symbol.iterator]())) : undefined,
	'%JSON%': typeof JSON === 'object' ? JSON : undefined,
	'%Map%': typeof Map === 'undefined' ? undefined : Map,
	'%MapIteratorPrototype%': typeof Map === 'undefined' || !hasSymbols || !getProto ? undefined : getProto(new Map()[Symbol.iterator]()),
	'%Math%': Math,
	'%Number%': Number,
	'%Object%': Object,
	'%parseFloat%': parseFloat,
	'%parseInt%': parseInt,
	'%Promise%': typeof Promise === 'undefined' ? undefined : Promise,
	'%Proxy%': typeof Proxy === 'undefined' ? undefined : Proxy,
	'%RangeError%': RangeError,
	'%ReferenceError%': ReferenceError,
	'%Reflect%': typeof Reflect === 'undefined' ? undefined : Reflect,
	'%RegExp%': RegExp,
	'%Set%': typeof Set === 'undefined' ? undefined : Set,
	'%SetIteratorPrototype%': typeof Set === 'undefined' || !hasSymbols || !getProto ? undefined : getProto(new Set()[Symbol.iterator]()),
	'%SharedArrayBuffer%': typeof SharedArrayBuffer === 'undefined' ? undefined : SharedArrayBuffer,
	'%String%': String,
	'%StringIteratorPrototype%': hasSymbols && getProto ? getProto(''[Symbol.iterator]()) : undefined,
	'%Symbol%': hasSymbols ? Symbol : undefined,
	'%SyntaxError%': $SyntaxError,
	'%ThrowTypeError%': ThrowTypeError,
	'%TypedArray%': TypedArray,
	'%TypeError%': $TypeError,
	'%Uint8Array%': typeof Uint8Array === 'undefined' ? undefined : Uint8Array,
	'%Uint8ClampedArray%': typeof Uint8ClampedArray === 'undefined' ? undefined : Uint8ClampedArray,
	'%Uint16Array%': typeof Uint16Array === 'undefined' ? undefined : Uint16Array,
	'%Uint32Array%': typeof Uint32Array === 'undefined' ? undefined : Uint32Array,
	'%URIError%': URIError,
	'%WeakMap%': typeof WeakMap === 'undefined' ? undefined : WeakMap,
	'%WeakRef%': typeof WeakRef === 'undefined' ? undefined : WeakRef,
	'%WeakSet%': typeof WeakSet === 'undefined' ? undefined : WeakSet
};

if (getProto) {
	try {
		null.error; // eslint-disable-line no-unused-expressions
	} catch (e) {
		// https://github.com/tc39/proposal-shadowrealm/pull/384#issuecomment-1364264229
		var errorProto = getProto(getProto(e));
		INTRINSICS['%Error.prototype%'] = errorProto;
	}
}

var doEval = function doEval(name) {
	var value;
	if (name === '%AsyncFunction%') {
		value = getEvalledConstructor('async function () {}');
	} else if (name === '%GeneratorFunction%') {
		value = getEvalledConstructor('function* () {}');
	} else if (name === '%AsyncGeneratorFunction%') {
		value = getEvalledConstructor('async function* () {}');
	} else if (name === '%AsyncGenerator%') {
		var fn = doEval('%AsyncGeneratorFunction%');
		if (fn) {
			value = fn.prototype;
		}
	} else if (name === '%AsyncIteratorPrototype%') {
		var gen = doEval('%AsyncGenerator%');
		if (gen && getProto) {
			value = getProto(gen.prototype);
		}
	}

	INTRINSICS[name] = value;

	return value;
};

var LEGACY_ALIASES = {
	'%ArrayBufferPrototype%': ['ArrayBuffer', 'prototype'],
	'%ArrayPrototype%': ['Array', 'prototype'],
	'%ArrayProto_entries%': ['Array', 'prototype', 'entries'],
	'%ArrayProto_forEach%': ['Array', 'prototype', 'forEach'],
	'%ArrayProto_keys%': ['Array', 'prototype', 'keys'],
	'%ArrayProto_values%': ['Array', 'prototype', 'values'],
	'%AsyncFunctionPrototype%': ['AsyncFunction', 'prototype'],
	'%AsyncGenerator%': ['AsyncGeneratorFunction', 'prototype'],
	'%AsyncGeneratorPrototype%': ['AsyncGeneratorFunction', 'prototype', 'prototype'],
	'%BooleanPrototype%': ['Boolean', 'prototype'],
	'%DataViewPrototype%': ['DataView', 'prototype'],
	'%DatePrototype%': ['Date', 'prototype'],
	'%ErrorPrototype%': ['Error', 'prototype'],
	'%EvalErrorPrototype%': ['EvalError', 'prototype'],
	'%Float32ArrayPrototype%': ['Float32Array', 'prototype'],
	'%Float64ArrayPrototype%': ['Float64Array', 'prototype'],
	'%FunctionPrototype%': ['Function', 'prototype'],
	'%Generator%': ['GeneratorFunction', 'prototype'],
	'%GeneratorPrototype%': ['GeneratorFunction', 'prototype', 'prototype'],
	'%Int8ArrayPrototype%': ['Int8Array', 'prototype'],
	'%Int16ArrayPrototype%': ['Int16Array', 'prototype'],
	'%Int32ArrayPrototype%': ['Int32Array', 'prototype'],
	'%JSONParse%': ['JSON', 'parse'],
	'%JSONStringify%': ['JSON', 'stringify'],
	'%MapPrototype%': ['Map', 'prototype'],
	'%NumberPrototype%': ['Number', 'prototype'],
	'%ObjectPrototype%': ['Object', 'prototype'],
	'%ObjProto_toString%': ['Object', 'prototype', 'toString'],
	'%ObjProto_valueOf%': ['Object', 'prototype', 'valueOf'],
	'%PromisePrototype%': ['Promise', 'prototype'],
	'%PromiseProto_then%': ['Promise', 'prototype', 'then'],
	'%Promise_all%': ['Promise', 'all'],
	'%Promise_reject%': ['Promise', 'reject'],
	'%Promise_resolve%': ['Promise', 'resolve'],
	'%RangeErrorPrototype%': ['RangeError', 'prototype'],
	'%ReferenceErrorPrototype%': ['ReferenceError', 'prototype'],
	'%RegExpPrototype%': ['RegExp', 'prototype'],
	'%SetPrototype%': ['Set', 'prototype'],
	'%SharedArrayBufferPrototype%': ['SharedArrayBuffer', 'prototype'],
	'%StringPrototype%': ['String', 'prototype'],
	'%SymbolPrototype%': ['Symbol', 'prototype'],
	'%SyntaxErrorPrototype%': ['SyntaxError', 'prototype'],
	'%TypedArrayPrototype%': ['TypedArray', 'prototype'],
	'%TypeErrorPrototype%': ['TypeError', 'prototype'],
	'%Uint8ArrayPrototype%': ['Uint8Array', 'prototype'],
	'%Uint8ClampedArrayPrototype%': ['Uint8ClampedArray', 'prototype'],
	'%Uint16ArrayPrototype%': ['Uint16Array', 'prototype'],
	'%Uint32ArrayPrototype%': ['Uint32Array', 'prototype'],
	'%URIErrorPrototype%': ['URIError', 'prototype'],
	'%WeakMapPrototype%': ['WeakMap', 'prototype'],
	'%WeakSetPrototype%': ['WeakSet', 'prototype']
};

var bind = require('function-bind');
var hasOwn = require('hasown');
var $concat = bind.call(Function.call, Array.prototype.concat);
var $spliceApply = bind.call(Function.apply, Array.prototype.splice);
var $replace = bind.call(Function.call, String.prototype.replace);
var $strSlice = bind.call(Function.call, String.prototype.slice);
var $exec = bind.call(Function.call, RegExp.prototype.exec);

/* adapted from https://github.com/lodash/lodash/blob/4.17.15/dist/lodash.js#L6735-L6744 */
var rePropName = /[^%.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|%$))/g;
var reEscapeChar = /\\(\\)?/g; /** Used to match backslashes in property paths. */
var stringToPath = function stringToPath(string) {
	var first = $strSlice(string, 0, 1);
	var last = $strSlice(string, -1);
	if (first === '%' && last !== '%') {
		throw new $SyntaxError('invalid intrinsic syntax, expected closing `%`');
	} else if (last === '%' && first !== '%') {
		throw new $SyntaxError('invalid intrinsic syntax, expected opening `%`');
	}
	var result = [];
	$replace(string, rePropName, function (match, number, quote, subString) {
		result[result.length] = quote ? $replace(subString, reEscapeChar, '$1') : number || match;
	});
	return result;
};
/* end adaptation */

var getBaseIntrinsic = function getBaseIntrinsic(name, allowMissing) {
	var intrinsicName = name;
	var alias;
	if (hasOwn(LEGACY_ALIASES, intrinsicName)) {
		alias = LEGACY_ALIASES[intrinsicName];
		intrinsicName = '%' + alias[0] + '%';
	}

	if (hasOwn(INTRINSICS, intrinsicName)) {
		var value = INTRINSICS[intrinsicName];
		if (value === needsEval) {
			value = doEval(intrinsicName);
		}
		if (typeof value === 'undefined' && !allowMissing) {
			throw new $TypeError('intrinsic ' + name + ' exists, but is not available. Please file an issue!');
		}

		return {
			alias: alias,
			name: intrinsicName,
			value: value
		};
	}

	throw new $SyntaxError('intrinsic ' + name + ' does not exist!');
};

module.exports = function GetIntrinsic(name, allowMissing) {
	if (typeof name !== 'string' || name.length === 0) {
		throw new $TypeError('intrinsic name must be a non-empty string');
	}
	if (arguments.length > 1 && typeof allowMissing !== 'boolean') {
		throw new $TypeError('"allowMissing" argument must be a boolean');
	}

	if ($exec(/^%?[^%]*%?$/, name) === null) {
		throw new $SyntaxError('`%` may not be present anywhere but at the beginning and end of the intrinsic name');
	}
	var parts = stringToPath(name);
	var intrinsicBaseName = parts.length > 0 ? parts[0] : '';

	var intrinsic = getBaseIntrinsic('%' + intrinsicBaseName + '%', allowMissing);
	var intrinsicRealName = intrinsic.name;
	var value = intrinsic.value;
	var skipFurtherCaching = false;

	var alias = intrinsic.alias;
	if (alias) {
		intrinsicBaseName = alias[0];
		$spliceApply(parts, $concat([0, 1], alias));
	}

	for (var i = 1, isOwn = true; i < parts.length; i += 1) {
		var part = parts[i];
		var first = $strSlice(part, 0, 1);
		var last = $strSlice(part, -1);
		if (
			(
				(first === '"' || first === "'" || first === '`')
				|| (last === '"' || last === "'" || last === '`')
			)
			&& first !== last
		) {
			throw new $SyntaxError('property names with quotes must have matching quotes');
		}
		if (part === 'constructor' || !isOwn) {
			skipFurtherCaching = true;
		}

		intrinsicBaseName += '.' + part;
		intrinsicRealName = '%' + intrinsicBaseName + '%';

		if (hasOwn(INTRINSICS, intrinsicRealName)) {
			value = INTRINSICS[intrinsicRealName];
		} else if (value != null) {
			if (!(part in value)) {
				if (!allowMissing) {
					throw new $TypeError('base intrinsic for ' + name + ' exists, but the property is not available.');
				}
				return void undefined;
			}
			if ($gOPD && (i + 1) >= parts.length) {
				var desc = $gOPD(value, part);
				isOwn = !!desc;

				// By convention, when a data property is converted to an accessor
				// property to emulate a data property that does not suffer from
				// the override mistake, that accessor's getter is marked with
				// an `originalValue` property. Here, when we detect this, we
				// uphold the illusion by pretending to see that original data
				// property, i.e., returning the value rather than the getter
				// itself.
				if (isOwn && 'get' in desc && !('originalValue' in desc.get)) {
					value = desc.get;
				} else {
					value = value[part];
				}
			} else {
				isOwn = hasOwn(value, part);
				value = value[part];
			}

			if (isOwn && !skipFurtherCaching) {
				INTRINSICS[intrinsicRealName] = value;
			}
		}
	}
	return value;
};

},{"function-bind":56,"has-proto":60,"has-symbols":61,"hasown":64}],58:[function(require,module,exports){
'use strict';

var GetIntrinsic = require('get-intrinsic');

var $gOPD = GetIntrinsic('%Object.getOwnPropertyDescriptor%', true);

if ($gOPD) {
	try {
		$gOPD([], 'length');
	} catch (e) {
		// IE 8 has a broken gOPD
		$gOPD = null;
	}
}

module.exports = $gOPD;

},{"get-intrinsic":57}],59:[function(require,module,exports){
'use strict';

var GetIntrinsic = require('get-intrinsic');

var $defineProperty = GetIntrinsic('%Object.defineProperty%', true);

var hasPropertyDescriptors = function hasPropertyDescriptors() {
	if ($defineProperty) {
		try {
			$defineProperty({}, 'a', { value: 1 });
			return true;
		} catch (e) {
			// IE 8 has a broken defineProperty
			return false;
		}
	}
	return false;
};

hasPropertyDescriptors.hasArrayLengthDefineBug = function hasArrayLengthDefineBug() {
	// node v0.6 has a bug where array lengths can be Set but not Defined
	if (!hasPropertyDescriptors()) {
		return null;
	}
	try {
		return $defineProperty([], 'length', { value: 1 }).length !== 1;
	} catch (e) {
		// In Firefox 4-22, defining length on an array throws an exception.
		return true;
	}
};

module.exports = hasPropertyDescriptors;

},{"get-intrinsic":57}],60:[function(require,module,exports){
'use strict';

var test = {
	foo: {}
};

var $Object = Object;

module.exports = function hasProto() {
	return { __proto__: test }.foo === test.foo && !({ __proto__: null } instanceof $Object);
};

},{}],61:[function(require,module,exports){
'use strict';

var origSymbol = typeof Symbol !== 'undefined' && Symbol;
var hasSymbolSham = require('./shams');

module.exports = function hasNativeSymbols() {
	if (typeof origSymbol !== 'function') { return false; }
	if (typeof Symbol !== 'function') { return false; }
	if (typeof origSymbol('foo') !== 'symbol') { return false; }
	if (typeof Symbol('bar') !== 'symbol') { return false; }

	return hasSymbolSham();
};

},{"./shams":62}],62:[function(require,module,exports){
'use strict';

/* eslint complexity: [2, 18], max-statements: [2, 33] */
module.exports = function hasSymbols() {
	if (typeof Symbol !== 'function' || typeof Object.getOwnPropertySymbols !== 'function') { return false; }
	if (typeof Symbol.iterator === 'symbol') { return true; }

	var obj = {};
	var sym = Symbol('test');
	var symObj = Object(sym);
	if (typeof sym === 'string') { return false; }

	if (Object.prototype.toString.call(sym) !== '[object Symbol]') { return false; }
	if (Object.prototype.toString.call(symObj) !== '[object Symbol]') { return false; }

	// temp disabled per https://github.com/ljharb/object.assign/issues/17
	// if (sym instanceof Symbol) { return false; }
	// temp disabled per https://github.com/WebReflection/get-own-property-symbols/issues/4
	// if (!(symObj instanceof Symbol)) { return false; }

	// if (typeof Symbol.prototype.toString !== 'function') { return false; }
	// if (String(sym) !== Symbol.prototype.toString.call(sym)) { return false; }

	var symVal = 42;
	obj[sym] = symVal;
	for (sym in obj) { return false; } // eslint-disable-line no-restricted-syntax, no-unreachable-loop
	if (typeof Object.keys === 'function' && Object.keys(obj).length !== 0) { return false; }

	if (typeof Object.getOwnPropertyNames === 'function' && Object.getOwnPropertyNames(obj).length !== 0) { return false; }

	var syms = Object.getOwnPropertySymbols(obj);
	if (syms.length !== 1 || syms[0] !== sym) { return false; }

	if (!Object.prototype.propertyIsEnumerable.call(obj, sym)) { return false; }

	if (typeof Object.getOwnPropertyDescriptor === 'function') {
		var descriptor = Object.getOwnPropertyDescriptor(obj, sym);
		if (descriptor.value !== symVal || descriptor.enumerable !== true) { return false; }
	}

	return true;
};

},{}],63:[function(require,module,exports){
'use strict';

var hasSymbols = require('has-symbols/shams');

module.exports = function hasToStringTagShams() {
	return hasSymbols() && !!Symbol.toStringTag;
};

},{"has-symbols/shams":62}],64:[function(require,module,exports){
'use strict';

var call = Function.prototype.call;
var $hasOwn = Object.prototype.hasOwnProperty;
var bind = require('function-bind');

/** @type {(o: {}, p: PropertyKey) => p is keyof o} */
module.exports = bind.call(call, $hasOwn);

},{"function-bind":56}],65:[function(require,module,exports){
/*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],66:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor
      ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
          value: ctor,
          enumerable: false,
          writable: true,
          configurable: true
        }
      })
    }
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor
      var TempCtor = function () {}
      TempCtor.prototype = superCtor.prototype
      ctor.prototype = new TempCtor()
      ctor.prototype.constructor = ctor
    }
  }
}

},{}],67:[function(require,module,exports){
'use strict';

var hasToStringTag = require('has-tostringtag/shams')();
var callBound = require('call-bind/callBound');

var $toString = callBound('Object.prototype.toString');

var isStandardArguments = function isArguments(value) {
	if (hasToStringTag && value && typeof value === 'object' && Symbol.toStringTag in value) {
		return false;
	}
	return $toString(value) === '[object Arguments]';
};

var isLegacyArguments = function isArguments(value) {
	if (isStandardArguments(value)) {
		return true;
	}
	return value !== null &&
		typeof value === 'object' &&
		typeof value.length === 'number' &&
		value.length >= 0 &&
		$toString(value) !== '[object Array]' &&
		$toString(value.callee) === '[object Function]';
};

var supportsStandardArguments = (function () {
	return isStandardArguments(arguments);
}());

isStandardArguments.isLegacyArguments = isLegacyArguments; // for tests

module.exports = supportsStandardArguments ? isStandardArguments : isLegacyArguments;

},{"call-bind/callBound":51,"has-tostringtag/shams":63}],68:[function(require,module,exports){
/*!
 * Determine if an object is a Buffer
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */

// The _isBuffer check is for Safari 5-7 support, because it's missing
// Object.prototype.constructor. Remove this eventually
module.exports = function (obj) {
  return obj != null && (isBuffer(obj) || isSlowBuffer(obj) || !!obj._isBuffer)
}

function isBuffer (obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

// For Node v0.10 support. Remove this eventually.
function isSlowBuffer (obj) {
  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isBuffer(obj.slice(0, 0))
}

},{}],69:[function(require,module,exports){
'use strict';

var fnToStr = Function.prototype.toString;
var reflectApply = typeof Reflect === 'object' && Reflect !== null && Reflect.apply;
var badArrayLike;
var isCallableMarker;
if (typeof reflectApply === 'function' && typeof Object.defineProperty === 'function') {
	try {
		badArrayLike = Object.defineProperty({}, 'length', {
			get: function () {
				throw isCallableMarker;
			}
		});
		isCallableMarker = {};
		// eslint-disable-next-line no-throw-literal
		reflectApply(function () { throw 42; }, null, badArrayLike);
	} catch (_) {
		if (_ !== isCallableMarker) {
			reflectApply = null;
		}
	}
} else {
	reflectApply = null;
}

var constructorRegex = /^\s*class\b/;
var isES6ClassFn = function isES6ClassFunction(value) {
	try {
		var fnStr = fnToStr.call(value);
		return constructorRegex.test(fnStr);
	} catch (e) {
		return false; // not a function
	}
};

var tryFunctionObject = function tryFunctionToStr(value) {
	try {
		if (isES6ClassFn(value)) { return false; }
		fnToStr.call(value);
		return true;
	} catch (e) {
		return false;
	}
};
var toStr = Object.prototype.toString;
var objectClass = '[object Object]';
var fnClass = '[object Function]';
var genClass = '[object GeneratorFunction]';
var ddaClass = '[object HTMLAllCollection]'; // IE 11
var ddaClass2 = '[object HTML document.all class]';
var ddaClass3 = '[object HTMLCollection]'; // IE 9-10
var hasToStringTag = typeof Symbol === 'function' && !!Symbol.toStringTag; // better: use `has-tostringtag`

var isIE68 = !(0 in [,]); // eslint-disable-line no-sparse-arrays, comma-spacing

var isDDA = function isDocumentDotAll() { return false; };
if (typeof document === 'object') {
	// Firefox 3 canonicalizes DDA to undefined when it's not accessed directly
	var all = document.all;
	if (toStr.call(all) === toStr.call(document.all)) {
		isDDA = function isDocumentDotAll(value) {
			/* globals document: false */
			// in IE 6-8, typeof document.all is "object" and it's truthy
			if ((isIE68 || !value) && (typeof value === 'undefined' || typeof value === 'object')) {
				try {
					var str = toStr.call(value);
					return (
						str === ddaClass
						|| str === ddaClass2
						|| str === ddaClass3 // opera 12.16
						|| str === objectClass // IE 6-8
					) && value('') == null; // eslint-disable-line eqeqeq
				} catch (e) { /**/ }
			}
			return false;
		};
	}
}

module.exports = reflectApply
	? function isCallable(value) {
		if (isDDA(value)) { return true; }
		if (!value) { return false; }
		if (typeof value !== 'function' && typeof value !== 'object') { return false; }
		try {
			reflectApply(value, null, badArrayLike);
		} catch (e) {
			if (e !== isCallableMarker) { return false; }
		}
		return !isES6ClassFn(value) && tryFunctionObject(value);
	}
	: function isCallable(value) {
		if (isDDA(value)) { return true; }
		if (!value) { return false; }
		if (typeof value !== 'function' && typeof value !== 'object') { return false; }
		if (hasToStringTag) { return tryFunctionObject(value); }
		if (isES6ClassFn(value)) { return false; }
		var strClass = toStr.call(value);
		if (strClass !== fnClass && strClass !== genClass && !(/^\[object HTML/).test(strClass)) { return false; }
		return tryFunctionObject(value);
	};

},{}],70:[function(require,module,exports){
'use strict';

var toStr = Object.prototype.toString;
var fnToStr = Function.prototype.toString;
var isFnRegex = /^\s*(?:function)?\*/;
var hasToStringTag = require('has-tostringtag/shams')();
var getProto = Object.getPrototypeOf;
var getGeneratorFunc = function () { // eslint-disable-line consistent-return
	if (!hasToStringTag) {
		return false;
	}
	try {
		return Function('return function*() {}')();
	} catch (e) {
	}
};
var GeneratorFunction;

module.exports = function isGeneratorFunction(fn) {
	if (typeof fn !== 'function') {
		return false;
	}
	if (isFnRegex.test(fnToStr.call(fn))) {
		return true;
	}
	if (!hasToStringTag) {
		var str = toStr.call(fn);
		return str === '[object GeneratorFunction]';
	}
	if (!getProto) {
		return false;
	}
	if (typeof GeneratorFunction === 'undefined') {
		var generatorFunc = getGeneratorFunc();
		GeneratorFunction = generatorFunc ? getProto(generatorFunc) : false;
	}
	return getProto(fn) === GeneratorFunction;
};

},{"has-tostringtag/shams":63}],71:[function(require,module,exports){
'use strict';

var whichTypedArray = require('which-typed-array');

module.exports = function isTypedArray(value) {
	return !!whichTypedArray(value);
};

},{"which-typed-array":80}],72:[function(require,module,exports){
exports.endianness = function () { return 'LE' };

exports.hostname = function () {
    if (typeof location !== 'undefined') {
        return location.hostname
    }
    else return '';
};

exports.loadavg = function () { return [] };

exports.uptime = function () { return 0 };

exports.freemem = function () {
    return Number.MAX_VALUE;
};

exports.totalmem = function () {
    return Number.MAX_VALUE;
};

exports.cpus = function () { return [] };

exports.type = function () { return 'Browser' };

exports.release = function () {
    if (typeof navigator !== 'undefined') {
        return navigator.appVersion;
    }
    return '';
};

exports.networkInterfaces
= exports.getNetworkInterfaces
= function () { return {} };

exports.arch = function () { return 'javascript' };

exports.platform = function () { return 'browser' };

exports.tmpdir = exports.tmpDir = function () {
    return '/tmp';
};

exports.EOL = '\n';

exports.homedir = function () {
	return '/'
};

},{}],73:[function(require,module,exports){
(function (process){(function (){
// 'path' module extracted from Node.js v8.11.1 (only the posix part)
// transplited with Babel

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

function assertPath(path) {
  if (typeof path !== 'string') {
    throw new TypeError('Path must be a string. Received ' + JSON.stringify(path));
  }
}

// Resolves . and .. elements in a path with directory names
function normalizeStringPosix(path, allowAboveRoot) {
  var res = '';
  var lastSegmentLength = 0;
  var lastSlash = -1;
  var dots = 0;
  var code;
  for (var i = 0; i <= path.length; ++i) {
    if (i < path.length)
      code = path.charCodeAt(i);
    else if (code === 47 /*/*/)
      break;
    else
      code = 47 /*/*/;
    if (code === 47 /*/*/) {
      if (lastSlash === i - 1 || dots === 1) {
        // NOOP
      } else if (lastSlash !== i - 1 && dots === 2) {
        if (res.length < 2 || lastSegmentLength !== 2 || res.charCodeAt(res.length - 1) !== 46 /*.*/ || res.charCodeAt(res.length - 2) !== 46 /*.*/) {
          if (res.length > 2) {
            var lastSlashIndex = res.lastIndexOf('/');
            if (lastSlashIndex !== res.length - 1) {
              if (lastSlashIndex === -1) {
                res = '';
                lastSegmentLength = 0;
              } else {
                res = res.slice(0, lastSlashIndex);
                lastSegmentLength = res.length - 1 - res.lastIndexOf('/');
              }
              lastSlash = i;
              dots = 0;
              continue;
            }
          } else if (res.length === 2 || res.length === 1) {
            res = '';
            lastSegmentLength = 0;
            lastSlash = i;
            dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          if (res.length > 0)
            res += '/..';
          else
            res = '..';
          lastSegmentLength = 2;
        }
      } else {
        if (res.length > 0)
          res += '/' + path.slice(lastSlash + 1, i);
        else
          res = path.slice(lastSlash + 1, i);
        lastSegmentLength = i - lastSlash - 1;
      }
      lastSlash = i;
      dots = 0;
    } else if (code === 46 /*.*/ && dots !== -1) {
      ++dots;
    } else {
      dots = -1;
    }
  }
  return res;
}

function _format(sep, pathObject) {
  var dir = pathObject.dir || pathObject.root;
  var base = pathObject.base || (pathObject.name || '') + (pathObject.ext || '');
  if (!dir) {
    return base;
  }
  if (dir === pathObject.root) {
    return dir + base;
  }
  return dir + sep + base;
}

var posix = {
  // path.resolve([from ...], to)
  resolve: function resolve() {
    var resolvedPath = '';
    var resolvedAbsolute = false;
    var cwd;

    for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      var path;
      if (i >= 0)
        path = arguments[i];
      else {
        if (cwd === undefined)
          cwd = process.cwd();
        path = cwd;
      }

      assertPath(path);

      // Skip empty entries
      if (path.length === 0) {
        continue;
      }

      resolvedPath = path + '/' + resolvedPath;
      resolvedAbsolute = path.charCodeAt(0) === 47 /*/*/;
    }

    // At this point the path should be resolved to a full absolute path, but
    // handle relative paths to be safe (might happen when process.cwd() fails)

    // Normalize the path
    resolvedPath = normalizeStringPosix(resolvedPath, !resolvedAbsolute);

    if (resolvedAbsolute) {
      if (resolvedPath.length > 0)
        return '/' + resolvedPath;
      else
        return '/';
    } else if (resolvedPath.length > 0) {
      return resolvedPath;
    } else {
      return '.';
    }
  },

  normalize: function normalize(path) {
    assertPath(path);

    if (path.length === 0) return '.';

    var isAbsolute = path.charCodeAt(0) === 47 /*/*/;
    var trailingSeparator = path.charCodeAt(path.length - 1) === 47 /*/*/;

    // Normalize the path
    path = normalizeStringPosix(path, !isAbsolute);

    if (path.length === 0 && !isAbsolute) path = '.';
    if (path.length > 0 && trailingSeparator) path += '/';

    if (isAbsolute) return '/' + path;
    return path;
  },

  isAbsolute: function isAbsolute(path) {
    assertPath(path);
    return path.length > 0 && path.charCodeAt(0) === 47 /*/*/;
  },

  join: function join() {
    if (arguments.length === 0)
      return '.';
    var joined;
    for (var i = 0; i < arguments.length; ++i) {
      var arg = arguments[i];
      assertPath(arg);
      if (arg.length > 0) {
        if (joined === undefined)
          joined = arg;
        else
          joined += '/' + arg;
      }
    }
    if (joined === undefined)
      return '.';
    return posix.normalize(joined);
  },

  relative: function relative(from, to) {
    assertPath(from);
    assertPath(to);

    if (from === to) return '';

    from = posix.resolve(from);
    to = posix.resolve(to);

    if (from === to) return '';

    // Trim any leading backslashes
    var fromStart = 1;
    for (; fromStart < from.length; ++fromStart) {
      if (from.charCodeAt(fromStart) !== 47 /*/*/)
        break;
    }
    var fromEnd = from.length;
    var fromLen = fromEnd - fromStart;

    // Trim any leading backslashes
    var toStart = 1;
    for (; toStart < to.length; ++toStart) {
      if (to.charCodeAt(toStart) !== 47 /*/*/)
        break;
    }
    var toEnd = to.length;
    var toLen = toEnd - toStart;

    // Compare paths to find the longest common path from root
    var length = fromLen < toLen ? fromLen : toLen;
    var lastCommonSep = -1;
    var i = 0;
    for (; i <= length; ++i) {
      if (i === length) {
        if (toLen > length) {
          if (to.charCodeAt(toStart + i) === 47 /*/*/) {
            // We get here if `from` is the exact base path for `to`.
            // For example: from='/foo/bar'; to='/foo/bar/baz'
            return to.slice(toStart + i + 1);
          } else if (i === 0) {
            // We get here if `from` is the root
            // For example: from='/'; to='/foo'
            return to.slice(toStart + i);
          }
        } else if (fromLen > length) {
          if (from.charCodeAt(fromStart + i) === 47 /*/*/) {
            // We get here if `to` is the exact base path for `from`.
            // For example: from='/foo/bar/baz'; to='/foo/bar'
            lastCommonSep = i;
          } else if (i === 0) {
            // We get here if `to` is the root.
            // For example: from='/foo'; to='/'
            lastCommonSep = 0;
          }
        }
        break;
      }
      var fromCode = from.charCodeAt(fromStart + i);
      var toCode = to.charCodeAt(toStart + i);
      if (fromCode !== toCode)
        break;
      else if (fromCode === 47 /*/*/)
        lastCommonSep = i;
    }

    var out = '';
    // Generate the relative path based on the path difference between `to`
    // and `from`
    for (i = fromStart + lastCommonSep + 1; i <= fromEnd; ++i) {
      if (i === fromEnd || from.charCodeAt(i) === 47 /*/*/) {
        if (out.length === 0)
          out += '..';
        else
          out += '/..';
      }
    }

    // Lastly, append the rest of the destination (`to`) path that comes after
    // the common path parts
    if (out.length > 0)
      return out + to.slice(toStart + lastCommonSep);
    else {
      toStart += lastCommonSep;
      if (to.charCodeAt(toStart) === 47 /*/*/)
        ++toStart;
      return to.slice(toStart);
    }
  },

  _makeLong: function _makeLong(path) {
    return path;
  },

  dirname: function dirname(path) {
    assertPath(path);
    if (path.length === 0) return '.';
    var code = path.charCodeAt(0);
    var hasRoot = code === 47 /*/*/;
    var end = -1;
    var matchedSlash = true;
    for (var i = path.length - 1; i >= 1; --i) {
      code = path.charCodeAt(i);
      if (code === 47 /*/*/) {
          if (!matchedSlash) {
            end = i;
            break;
          }
        } else {
        // We saw the first non-path separator
        matchedSlash = false;
      }
    }

    if (end === -1) return hasRoot ? '/' : '.';
    if (hasRoot && end === 1) return '//';
    return path.slice(0, end);
  },

  basename: function basename(path, ext) {
    if (ext !== undefined && typeof ext !== 'string') throw new TypeError('"ext" argument must be a string');
    assertPath(path);

    var start = 0;
    var end = -1;
    var matchedSlash = true;
    var i;

    if (ext !== undefined && ext.length > 0 && ext.length <= path.length) {
      if (ext.length === path.length && ext === path) return '';
      var extIdx = ext.length - 1;
      var firstNonSlashEnd = -1;
      for (i = path.length - 1; i >= 0; --i) {
        var code = path.charCodeAt(i);
        if (code === 47 /*/*/) {
            // If we reached a path separator that was not part of a set of path
            // separators at the end of the string, stop now
            if (!matchedSlash) {
              start = i + 1;
              break;
            }
          } else {
          if (firstNonSlashEnd === -1) {
            // We saw the first non-path separator, remember this index in case
            // we need it if the extension ends up not matching
            matchedSlash = false;
            firstNonSlashEnd = i + 1;
          }
          if (extIdx >= 0) {
            // Try to match the explicit extension
            if (code === ext.charCodeAt(extIdx)) {
              if (--extIdx === -1) {
                // We matched the extension, so mark this as the end of our path
                // component
                end = i;
              }
            } else {
              // Extension does not match, so our result is the entire path
              // component
              extIdx = -1;
              end = firstNonSlashEnd;
            }
          }
        }
      }

      if (start === end) end = firstNonSlashEnd;else if (end === -1) end = path.length;
      return path.slice(start, end);
    } else {
      for (i = path.length - 1; i >= 0; --i) {
        if (path.charCodeAt(i) === 47 /*/*/) {
            // If we reached a path separator that was not part of a set of path
            // separators at the end of the string, stop now
            if (!matchedSlash) {
              start = i + 1;
              break;
            }
          } else if (end === -1) {
          // We saw the first non-path separator, mark this as the end of our
          // path component
          matchedSlash = false;
          end = i + 1;
        }
      }

      if (end === -1) return '';
      return path.slice(start, end);
    }
  },

  extname: function extname(path) {
    assertPath(path);
    var startDot = -1;
    var startPart = 0;
    var end = -1;
    var matchedSlash = true;
    // Track the state of characters (if any) we see before our first dot and
    // after any path separator we find
    var preDotState = 0;
    for (var i = path.length - 1; i >= 0; --i) {
      var code = path.charCodeAt(i);
      if (code === 47 /*/*/) {
          // If we reached a path separator that was not part of a set of path
          // separators at the end of the string, stop now
          if (!matchedSlash) {
            startPart = i + 1;
            break;
          }
          continue;
        }
      if (end === -1) {
        // We saw the first non-path separator, mark this as the end of our
        // extension
        matchedSlash = false;
        end = i + 1;
      }
      if (code === 46 /*.*/) {
          // If this is our first dot, mark it as the start of our extension
          if (startDot === -1)
            startDot = i;
          else if (preDotState !== 1)
            preDotState = 1;
      } else if (startDot !== -1) {
        // We saw a non-dot and non-path separator before our dot, so we should
        // have a good chance at having a non-empty extension
        preDotState = -1;
      }
    }

    if (startDot === -1 || end === -1 ||
        // We saw a non-dot character immediately before the dot
        preDotState === 0 ||
        // The (right-most) trimmed path component is exactly '..'
        preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
      return '';
    }
    return path.slice(startDot, end);
  },

  format: function format(pathObject) {
    if (pathObject === null || typeof pathObject !== 'object') {
      throw new TypeError('The "pathObject" argument must be of type Object. Received type ' + typeof pathObject);
    }
    return _format('/', pathObject);
  },

  parse: function parse(path) {
    assertPath(path);

    var ret = { root: '', dir: '', base: '', ext: '', name: '' };
    if (path.length === 0) return ret;
    var code = path.charCodeAt(0);
    var isAbsolute = code === 47 /*/*/;
    var start;
    if (isAbsolute) {
      ret.root = '/';
      start = 1;
    } else {
      start = 0;
    }
    var startDot = -1;
    var startPart = 0;
    var end = -1;
    var matchedSlash = true;
    var i = path.length - 1;

    // Track the state of characters (if any) we see before our first dot and
    // after any path separator we find
    var preDotState = 0;

    // Get non-dir info
    for (; i >= start; --i) {
      code = path.charCodeAt(i);
      if (code === 47 /*/*/) {
          // If we reached a path separator that was not part of a set of path
          // separators at the end of the string, stop now
          if (!matchedSlash) {
            startPart = i + 1;
            break;
          }
          continue;
        }
      if (end === -1) {
        // We saw the first non-path separator, mark this as the end of our
        // extension
        matchedSlash = false;
        end = i + 1;
      }
      if (code === 46 /*.*/) {
          // If this is our first dot, mark it as the start of our extension
          if (startDot === -1) startDot = i;else if (preDotState !== 1) preDotState = 1;
        } else if (startDot !== -1) {
        // We saw a non-dot and non-path separator before our dot, so we should
        // have a good chance at having a non-empty extension
        preDotState = -1;
      }
    }

    if (startDot === -1 || end === -1 ||
    // We saw a non-dot character immediately before the dot
    preDotState === 0 ||
    // The (right-most) trimmed path component is exactly '..'
    preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
      if (end !== -1) {
        if (startPart === 0 && isAbsolute) ret.base = ret.name = path.slice(1, end);else ret.base = ret.name = path.slice(startPart, end);
      }
    } else {
      if (startPart === 0 && isAbsolute) {
        ret.name = path.slice(1, startDot);
        ret.base = path.slice(1, end);
      } else {
        ret.name = path.slice(startPart, startDot);
        ret.base = path.slice(startPart, end);
      }
      ret.ext = path.slice(startDot, end);
    }

    if (startPart > 0) ret.dir = path.slice(0, startPart - 1);else if (isAbsolute) ret.dir = '/';

    return ret;
  },

  sep: '/',
  delimiter: ':',
  win32: null,
  posix: null
};

posix.posix = posix;

module.exports = posix;

}).call(this)}).call(this,require('_process'))
},{"_process":74}],74:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],75:[function(require,module,exports){
'use strict';

var GetIntrinsic = require('get-intrinsic');
var define = require('define-data-property');
var hasDescriptors = require('has-property-descriptors')();
var gOPD = require('gopd');

var $TypeError = GetIntrinsic('%TypeError%');
var $floor = GetIntrinsic('%Math.floor%');

/** @typedef {(...args: unknown[]) => unknown} Func */

/** @type {<T extends Func = Func>(fn: T, length: number, loose?: boolean) => T} */
module.exports = function setFunctionLength(fn, length) {
	if (typeof fn !== 'function') {
		throw new $TypeError('`fn` is not a function');
	}
	if (typeof length !== 'number' || length < 0 || length > 0xFFFFFFFF || $floor(length) !== length) {
		throw new $TypeError('`length` must be a positive 32-bit integer');
	}

	var loose = arguments.length > 2 && !!arguments[2];

	var functionLengthIsConfigurable = true;
	var functionLengthIsWritable = true;
	if ('length' in fn && gOPD) {
		var desc = gOPD(fn, 'length');
		if (desc && !desc.configurable) {
			functionLengthIsConfigurable = false;
		}
		if (desc && !desc.writable) {
			functionLengthIsWritable = false;
		}
	}

	if (functionLengthIsConfigurable || functionLengthIsWritable || !loose) {
		if (hasDescriptors) {
			define(/** @type {Parameters<define>[0]} */ (fn), 'length', length, true, true);
		} else {
			define(/** @type {Parameters<define>[0]} */ (fn), 'length', length);
		}
	}
	return fn;
};

},{"define-data-property":53,"get-intrinsic":57,"gopd":58,"has-property-descriptors":59}],76:[function(require,module,exports){
(function (setImmediate,clearImmediate){(function (){
var nextTick = require('process/browser.js').nextTick;
var apply = Function.prototype.apply;
var slice = Array.prototype.slice;
var immediateIds = {};
var nextImmediateId = 0;

// DOM APIs, for completeness

exports.setTimeout = function() {
  return new Timeout(apply.call(setTimeout, window, arguments), clearTimeout);
};
exports.setInterval = function() {
  return new Timeout(apply.call(setInterval, window, arguments), clearInterval);
};
exports.clearTimeout =
exports.clearInterval = function(timeout) { timeout.close(); };

function Timeout(id, clearFn) {
  this._id = id;
  this._clearFn = clearFn;
}
Timeout.prototype.unref = Timeout.prototype.ref = function() {};
Timeout.prototype.close = function() {
  this._clearFn.call(window, this._id);
};

// Does not start the time, just sets up the members needed.
exports.enroll = function(item, msecs) {
  clearTimeout(item._idleTimeoutId);
  item._idleTimeout = msecs;
};

exports.unenroll = function(item) {
  clearTimeout(item._idleTimeoutId);
  item._idleTimeout = -1;
};

exports._unrefActive = exports.active = function(item) {
  clearTimeout(item._idleTimeoutId);

  var msecs = item._idleTimeout;
  if (msecs >= 0) {
    item._idleTimeoutId = setTimeout(function onTimeout() {
      if (item._onTimeout)
        item._onTimeout();
    }, msecs);
  }
};

// That's not how node.js implements it but the exposed api is the same.
exports.setImmediate = typeof setImmediate === "function" ? setImmediate : function(fn) {
  var id = nextImmediateId++;
  var args = arguments.length < 2 ? false : slice.call(arguments, 1);

  immediateIds[id] = true;

  nextTick(function onNextTick() {
    if (immediateIds[id]) {
      // fn.call() is faster so we optimize for the common use-case
      // @see http://jsperf.com/call-apply-segu
      if (args) {
        fn.apply(null, args);
      } else {
        fn.call(null);
      }
      // Prevent ids from leaking
      exports.clearImmediate(id);
    }
  });

  return id;
};

exports.clearImmediate = typeof clearImmediate === "function" ? clearImmediate : function(id) {
  delete immediateIds[id];
};
}).call(this)}).call(this,require("timers").setImmediate,require("timers").clearImmediate)
},{"process/browser.js":74,"timers":76}],77:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],78:[function(require,module,exports){
// Currently in sync with Node.js lib/internal/util/types.js
// https://github.com/nodejs/node/commit/112cc7c27551254aa2b17098fb774867f05ed0d9

'use strict';

var isArgumentsObject = require('is-arguments');
var isGeneratorFunction = require('is-generator-function');
var whichTypedArray = require('which-typed-array');
var isTypedArray = require('is-typed-array');

function uncurryThis(f) {
  return f.call.bind(f);
}

var BigIntSupported = typeof BigInt !== 'undefined';
var SymbolSupported = typeof Symbol !== 'undefined';

var ObjectToString = uncurryThis(Object.prototype.toString);

var numberValue = uncurryThis(Number.prototype.valueOf);
var stringValue = uncurryThis(String.prototype.valueOf);
var booleanValue = uncurryThis(Boolean.prototype.valueOf);

if (BigIntSupported) {
  var bigIntValue = uncurryThis(BigInt.prototype.valueOf);
}

if (SymbolSupported) {
  var symbolValue = uncurryThis(Symbol.prototype.valueOf);
}

function checkBoxedPrimitive(value, prototypeValueOf) {
  if (typeof value !== 'object') {
    return false;
  }
  try {
    prototypeValueOf(value);
    return true;
  } catch(e) {
    return false;
  }
}

exports.isArgumentsObject = isArgumentsObject;
exports.isGeneratorFunction = isGeneratorFunction;
exports.isTypedArray = isTypedArray;

// Taken from here and modified for better browser support
// https://github.com/sindresorhus/p-is-promise/blob/cda35a513bda03f977ad5cde3a079d237e82d7ef/index.js
function isPromise(input) {
	return (
		(
			typeof Promise !== 'undefined' &&
			input instanceof Promise
		) ||
		(
			input !== null &&
			typeof input === 'object' &&
			typeof input.then === 'function' &&
			typeof input.catch === 'function'
		)
	);
}
exports.isPromise = isPromise;

function isArrayBufferView(value) {
  if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView) {
    return ArrayBuffer.isView(value);
  }

  return (
    isTypedArray(value) ||
    isDataView(value)
  );
}
exports.isArrayBufferView = isArrayBufferView;


function isUint8Array(value) {
  return whichTypedArray(value) === 'Uint8Array';
}
exports.isUint8Array = isUint8Array;

function isUint8ClampedArray(value) {
  return whichTypedArray(value) === 'Uint8ClampedArray';
}
exports.isUint8ClampedArray = isUint8ClampedArray;

function isUint16Array(value) {
  return whichTypedArray(value) === 'Uint16Array';
}
exports.isUint16Array = isUint16Array;

function isUint32Array(value) {
  return whichTypedArray(value) === 'Uint32Array';
}
exports.isUint32Array = isUint32Array;

function isInt8Array(value) {
  return whichTypedArray(value) === 'Int8Array';
}
exports.isInt8Array = isInt8Array;

function isInt16Array(value) {
  return whichTypedArray(value) === 'Int16Array';
}
exports.isInt16Array = isInt16Array;

function isInt32Array(value) {
  return whichTypedArray(value) === 'Int32Array';
}
exports.isInt32Array = isInt32Array;

function isFloat32Array(value) {
  return whichTypedArray(value) === 'Float32Array';
}
exports.isFloat32Array = isFloat32Array;

function isFloat64Array(value) {
  return whichTypedArray(value) === 'Float64Array';
}
exports.isFloat64Array = isFloat64Array;

function isBigInt64Array(value) {
  return whichTypedArray(value) === 'BigInt64Array';
}
exports.isBigInt64Array = isBigInt64Array;

function isBigUint64Array(value) {
  return whichTypedArray(value) === 'BigUint64Array';
}
exports.isBigUint64Array = isBigUint64Array;

function isMapToString(value) {
  return ObjectToString(value) === '[object Map]';
}
isMapToString.working = (
  typeof Map !== 'undefined' &&
  isMapToString(new Map())
);

function isMap(value) {
  if (typeof Map === 'undefined') {
    return false;
  }

  return isMapToString.working
    ? isMapToString(value)
    : value instanceof Map;
}
exports.isMap = isMap;

function isSetToString(value) {
  return ObjectToString(value) === '[object Set]';
}
isSetToString.working = (
  typeof Set !== 'undefined' &&
  isSetToString(new Set())
);
function isSet(value) {
  if (typeof Set === 'undefined') {
    return false;
  }

  return isSetToString.working
    ? isSetToString(value)
    : value instanceof Set;
}
exports.isSet = isSet;

function isWeakMapToString(value) {
  return ObjectToString(value) === '[object WeakMap]';
}
isWeakMapToString.working = (
  typeof WeakMap !== 'undefined' &&
  isWeakMapToString(new WeakMap())
);
function isWeakMap(value) {
  if (typeof WeakMap === 'undefined') {
    return false;
  }

  return isWeakMapToString.working
    ? isWeakMapToString(value)
    : value instanceof WeakMap;
}
exports.isWeakMap = isWeakMap;

function isWeakSetToString(value) {
  return ObjectToString(value) === '[object WeakSet]';
}
isWeakSetToString.working = (
  typeof WeakSet !== 'undefined' &&
  isWeakSetToString(new WeakSet())
);
function isWeakSet(value) {
  return isWeakSetToString(value);
}
exports.isWeakSet = isWeakSet;

function isArrayBufferToString(value) {
  return ObjectToString(value) === '[object ArrayBuffer]';
}
isArrayBufferToString.working = (
  typeof ArrayBuffer !== 'undefined' &&
  isArrayBufferToString(new ArrayBuffer())
);
function isArrayBuffer(value) {
  if (typeof ArrayBuffer === 'undefined') {
    return false;
  }

  return isArrayBufferToString.working
    ? isArrayBufferToString(value)
    : value instanceof ArrayBuffer;
}
exports.isArrayBuffer = isArrayBuffer;

function isDataViewToString(value) {
  return ObjectToString(value) === '[object DataView]';
}
isDataViewToString.working = (
  typeof ArrayBuffer !== 'undefined' &&
  typeof DataView !== 'undefined' &&
  isDataViewToString(new DataView(new ArrayBuffer(1), 0, 1))
);
function isDataView(value) {
  if (typeof DataView === 'undefined') {
    return false;
  }

  return isDataViewToString.working
    ? isDataViewToString(value)
    : value instanceof DataView;
}
exports.isDataView = isDataView;

// Store a copy of SharedArrayBuffer in case it's deleted elsewhere
var SharedArrayBufferCopy = typeof SharedArrayBuffer !== 'undefined' ? SharedArrayBuffer : undefined;
function isSharedArrayBufferToString(value) {
  return ObjectToString(value) === '[object SharedArrayBuffer]';
}
function isSharedArrayBuffer(value) {
  if (typeof SharedArrayBufferCopy === 'undefined') {
    return false;
  }

  if (typeof isSharedArrayBufferToString.working === 'undefined') {
    isSharedArrayBufferToString.working = isSharedArrayBufferToString(new SharedArrayBufferCopy());
  }

  return isSharedArrayBufferToString.working
    ? isSharedArrayBufferToString(value)
    : value instanceof SharedArrayBufferCopy;
}
exports.isSharedArrayBuffer = isSharedArrayBuffer;

function isAsyncFunction(value) {
  return ObjectToString(value) === '[object AsyncFunction]';
}
exports.isAsyncFunction = isAsyncFunction;

function isMapIterator(value) {
  return ObjectToString(value) === '[object Map Iterator]';
}
exports.isMapIterator = isMapIterator;

function isSetIterator(value) {
  return ObjectToString(value) === '[object Set Iterator]';
}
exports.isSetIterator = isSetIterator;

function isGeneratorObject(value) {
  return ObjectToString(value) === '[object Generator]';
}
exports.isGeneratorObject = isGeneratorObject;

function isWebAssemblyCompiledModule(value) {
  return ObjectToString(value) === '[object WebAssembly.Module]';
}
exports.isWebAssemblyCompiledModule = isWebAssemblyCompiledModule;

function isNumberObject(value) {
  return checkBoxedPrimitive(value, numberValue);
}
exports.isNumberObject = isNumberObject;

function isStringObject(value) {
  return checkBoxedPrimitive(value, stringValue);
}
exports.isStringObject = isStringObject;

function isBooleanObject(value) {
  return checkBoxedPrimitive(value, booleanValue);
}
exports.isBooleanObject = isBooleanObject;

function isBigIntObject(value) {
  return BigIntSupported && checkBoxedPrimitive(value, bigIntValue);
}
exports.isBigIntObject = isBigIntObject;

function isSymbolObject(value) {
  return SymbolSupported && checkBoxedPrimitive(value, symbolValue);
}
exports.isSymbolObject = isSymbolObject;

function isBoxedPrimitive(value) {
  return (
    isNumberObject(value) ||
    isStringObject(value) ||
    isBooleanObject(value) ||
    isBigIntObject(value) ||
    isSymbolObject(value)
  );
}
exports.isBoxedPrimitive = isBoxedPrimitive;

function isAnyArrayBuffer(value) {
  return typeof Uint8Array !== 'undefined' && (
    isArrayBuffer(value) ||
    isSharedArrayBuffer(value)
  );
}
exports.isAnyArrayBuffer = isAnyArrayBuffer;

['isProxy', 'isExternal', 'isModuleNamespaceObject'].forEach(function(method) {
  Object.defineProperty(exports, method, {
    enumerable: false,
    value: function() {
      throw new Error(method + ' is not supported in userland');
    }
  });
});

},{"is-arguments":67,"is-generator-function":70,"is-typed-array":71,"which-typed-array":80}],79:[function(require,module,exports){
(function (process){(function (){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var getOwnPropertyDescriptors = Object.getOwnPropertyDescriptors ||
  function getOwnPropertyDescriptors(obj) {
    var keys = Object.keys(obj);
    var descriptors = {};
    for (var i = 0; i < keys.length; i++) {
      descriptors[keys[i]] = Object.getOwnPropertyDescriptor(obj, keys[i]);
    }
    return descriptors;
  };

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  if (typeof process !== 'undefined' && process.noDeprecation === true) {
    return fn;
  }

  // Allow for deprecating things in the process of starting up.
  if (typeof process === 'undefined') {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnvRegex = /^$/;

if (process.env.NODE_DEBUG) {
  var debugEnv = process.env.NODE_DEBUG;
  debugEnv = debugEnv.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/,/g, '$|^')
    .toUpperCase();
  debugEnvRegex = new RegExp('^' + debugEnv + '$', 'i');
}
exports.debuglog = function(set) {
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (debugEnvRegex.test(set)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').slice(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.slice(1, -1);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
exports.types = require('./support/types');

function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;
exports.types.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;
exports.types.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;
exports.types.isNativeError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

var kCustomPromisifiedSymbol = typeof Symbol !== 'undefined' ? Symbol('util.promisify.custom') : undefined;

exports.promisify = function promisify(original) {
  if (typeof original !== 'function')
    throw new TypeError('The "original" argument must be of type Function');

  if (kCustomPromisifiedSymbol && original[kCustomPromisifiedSymbol]) {
    var fn = original[kCustomPromisifiedSymbol];
    if (typeof fn !== 'function') {
      throw new TypeError('The "util.promisify.custom" argument must be of type Function');
    }
    Object.defineProperty(fn, kCustomPromisifiedSymbol, {
      value: fn, enumerable: false, writable: false, configurable: true
    });
    return fn;
  }

  function fn() {
    var promiseResolve, promiseReject;
    var promise = new Promise(function (resolve, reject) {
      promiseResolve = resolve;
      promiseReject = reject;
    });

    var args = [];
    for (var i = 0; i < arguments.length; i++) {
      args.push(arguments[i]);
    }
    args.push(function (err, value) {
      if (err) {
        promiseReject(err);
      } else {
        promiseResolve(value);
      }
    });

    try {
      original.apply(this, args);
    } catch (err) {
      promiseReject(err);
    }

    return promise;
  }

  Object.setPrototypeOf(fn, Object.getPrototypeOf(original));

  if (kCustomPromisifiedSymbol) Object.defineProperty(fn, kCustomPromisifiedSymbol, {
    value: fn, enumerable: false, writable: false, configurable: true
  });
  return Object.defineProperties(
    fn,
    getOwnPropertyDescriptors(original)
  );
}

exports.promisify.custom = kCustomPromisifiedSymbol

function callbackifyOnRejected(reason, cb) {
  // `!reason` guard inspired by bluebird (Ref: https://goo.gl/t5IS6M).
  // Because `null` is a special error value in callbacks which means "no error
  // occurred", we error-wrap so the callback consumer can distinguish between
  // "the promise rejected with null" or "the promise fulfilled with undefined".
  if (!reason) {
    var newReason = new Error('Promise was rejected with a falsy value');
    newReason.reason = reason;
    reason = newReason;
  }
  return cb(reason);
}

function callbackify(original) {
  if (typeof original !== 'function') {
    throw new TypeError('The "original" argument must be of type Function');
  }

  // We DO NOT return the promise as it gives the user a false sense that
  // the promise is actually somehow related to the callback's execution
  // and that the callback throwing will reject the promise.
  function callbackified() {
    var args = [];
    for (var i = 0; i < arguments.length; i++) {
      args.push(arguments[i]);
    }

    var maybeCb = args.pop();
    if (typeof maybeCb !== 'function') {
      throw new TypeError('The last argument must be of type Function');
    }
    var self = this;
    var cb = function() {
      return maybeCb.apply(self, arguments);
    };
    // In true node style we process the callback on `nextTick` with all the
    // implications (stack, `uncaughtException`, `async_hooks`)
    original.apply(this, args)
      .then(function(ret) { process.nextTick(cb.bind(null, null, ret)) },
            function(rej) { process.nextTick(callbackifyOnRejected.bind(null, rej, cb)) });
  }

  Object.setPrototypeOf(callbackified, Object.getPrototypeOf(original));
  Object.defineProperties(callbackified,
                          getOwnPropertyDescriptors(original));
  return callbackified;
}
exports.callbackify = callbackify;

}).call(this)}).call(this,require('_process'))
},{"./support/isBuffer":77,"./support/types":78,"_process":74,"inherits":66}],80:[function(require,module,exports){
(function (global){(function (){
'use strict';

var forEach = require('for-each');
var availableTypedArrays = require('available-typed-arrays');
var callBind = require('call-bind');
var callBound = require('call-bind/callBound');
var gOPD = require('gopd');

var $toString = callBound('Object.prototype.toString');
var hasToStringTag = require('has-tostringtag/shams')();

var g = typeof globalThis === 'undefined' ? global : globalThis;
var typedArrays = availableTypedArrays();

var $slice = callBound('String.prototype.slice');
var getPrototypeOf = Object.getPrototypeOf; // require('getprototypeof');

var $indexOf = callBound('Array.prototype.indexOf', true) || function indexOf(array, value) {
	for (var i = 0; i < array.length; i += 1) {
		if (array[i] === value) {
			return i;
		}
	}
	return -1;
};
var cache = { __proto__: null };
if (hasToStringTag && gOPD && getPrototypeOf) {
	forEach(typedArrays, function (typedArray) {
		var arr = new g[typedArray]();
		if (Symbol.toStringTag in arr) {
			var proto = getPrototypeOf(arr);
			var descriptor = gOPD(proto, Symbol.toStringTag);
			if (!descriptor) {
				var superProto = getPrototypeOf(proto);
				descriptor = gOPD(superProto, Symbol.toStringTag);
			}
			cache['$' + typedArray] = callBind(descriptor.get);
		}
	});
} else {
	forEach(typedArrays, function (typedArray) {
		var arr = new g[typedArray]();
		var fn = arr.slice || arr.set;
		if (fn) {
			cache['$' + typedArray] = callBind(fn);
		}
	});
}

var tryTypedArrays = function tryAllTypedArrays(value) {
	var found = false;
	forEach(cache, function (getter, typedArray) {
		if (!found) {
			try {
				if ('$' + getter(value) === typedArray) {
					found = $slice(typedArray, 1);
				}
			} catch (e) { /**/ }
		}
	});
	return found;
};

var trySlices = function tryAllSlices(value) {
	var found = false;
	forEach(cache, function (getter, name) {
		if (!found) {
			try {
				getter(value);
				found = $slice(name, 1);
			} catch (e) { /**/ }
		}
	});
	return found;
};

module.exports = function whichTypedArray(value) {
	if (!value || typeof value !== 'object') { return false; }
	if (!hasToStringTag) {
		var tag = $slice($toString(value), 8, -1);
		if ($indexOf(typedArrays, tag) > -1) {
			return tag;
		}
		if (tag !== 'Object') {
			return false;
		}
		// node < 0.6 hits here on real Typed Arrays
		return trySlices(value);
	}
	if (!gOPD) { return null; } // unknown engine
	return tryTypedArrays(value);
};

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"available-typed-arrays":48,"call-bind":52,"call-bind/callBound":51,"for-each":54,"gopd":58,"has-tostringtag/shams":63}]},{},[2])(2)
});
