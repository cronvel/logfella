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



var tree = require( 'tree-kit' ) ;
var rootsDb = require( 'roots-db' ) ;





			/* RootsDb transport */



// Load modules
var CommonTransport = require( './Common.transport.js' ) ;



// Empty constructor, it is just there to support instanceof operator
function RootsDbTransport() { throw new Error( "[logger] Cannot create a RootsDbTransport object directly" ) ; }
module.exports = RootsDbTransport ;

// Inherits from CommonTransport
RootsDbTransport.prototype = Object.create( CommonTransport.prototype ) ;
RootsDbTransport.prototype.constructor = RootsDbTransport ;



RootsDbTransport.create = function create( logger , config )
{
	var transport = Object.create( RootsDbTransport.prototype ) ;
	transport.init( logger , config ) ;
	return transport ;
} ;



var logsSchema = {
	url: 'mongodb://localhost:27017/logger-kit/logs' ,
	properties: {
		app: { type: 'string' } ,
		uptime: { type: 'number' } ,
		domain: { type: 'string' } ,
		level: { type: 'integer' } ,
		levelName: { type: 'string' } ,
		time: { instanceOf: Date } ,
		code: { optional: true } ,
		pid: { type: 'integer' } ,
		hostname: { type: 'string' } ,
		meta: { type: 'strictObject' , optional: true } ,
		message: { type: 'string' , default: '' } ,
		messageData: { optional: true }
	} ,
	indexes: [] ,
	hooks: {}
} ;



RootsDbTransport.prototype.init = function create( logger , config )
{
	// Arguments management
	if ( config === null || typeof config !== 'object' ) { config = {} ; }
	
	var schema = tree.extend( { deep: true } , {} , logsSchema ) ;
	
	// Call parent init()
	CommonTransport.prototype.init.call( this , logger , config ) ;
	
	if ( typeof config.url === 'string' ) { schema.url = config.url ; }
	
	var world = rootsDb.World() ;
	var logs = world.createCollection( 'logs' , schema ) ;
	
	Object.defineProperties( this , {
		color: { value: !! config.color , writable: true , enumerable: true } ,
		indent: { value: !! config.indent , writable: true , enumerable: true } ,
		includeIdMeta: { value: !! config.includeIdMeta , writable: true , enumerable: true } ,
		includeCommonMeta: { value: !! config.includeCommonMeta , writable: true , enumerable: true } ,
		includeUserMeta: { value: !! config.includeUserMeta , writable: true , enumerable: true } ,
		schema: { value: schema , enumerable: true } ,
		world: { value: world , enumerable: true } ,
		logs: { value: logs , enumerable: true }
	} ) ;
} ;



RootsDbTransport.prototype.transport = function transport( data , callback )
{
	//console.log( this.message( time , level , levelName , domain , message ) ) ;
	
	var log = this.logs.createDocument( {
		app: data.app ,
		uptime: data.uptime ,
		pid: data.pid ,
		hostname: data.hostname ,
		domain: data.domain ,
		level: data.level ,
		levelName: data.levelName ,
		time: data.time ,//.getTime() ,
		code: data.code ,
		meta: data.meta || {} ,
		messageData: data.messageData ,
		message: this.formatMessage( data )
	} ) ;
	
	log.$.save( callback ) ;
} ;


