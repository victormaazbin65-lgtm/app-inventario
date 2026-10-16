import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {analizarRespaldo,coleccionesRequeridas} from '../scripts/revisar-respaldo.mjs';

function firmar(copia) {
    const contenido = JSON.stringify(Object.fromEntries(['formato','schemaVersion','appVersion','creadoEnISO','creadoEnTimestamp','sistema','colecciones','conteos'].map(k=>[k,copia[k]])));
    copia.integridad = {algoritmo:'SHA-256',hash:createHash('sha256').update(contenido).digest('hex')};
    return copia;
}
function copiaCompleta(cantidad) {
    const colecciones=Object.fromEntries(coleccionesRequeridas.map(nombre=>[nombre,[]]));
    colecciones.inventario=Array.from({length:cantidad},(_,i)=>({id:'p'+i,data:{id:'p'+i,nombre:'PRUEBA '+i,stock:1,costo:5}}));
    return firmar({formato:'sublicosturas-backup',schemaVersion:4,appVersion:'1.4.2',
        sistema:{config:{fondos:{costoProducto:0,costoLuzTinta:0,gananciaLibre:0,fondoImpuestos:0},saldosDinero:{efectivo:0,banco:0}}},
        colecciones,conteos:Object.fromEntries(Object.entries(colecciones).map(([nombre,filas])=>[nombre,filas.length]))});
}

test('revisar una copia grande conserva todos los documentos y produce un plan sin escribir',async()=>{
    const copia=copiaCompleta(500),antes=JSON.stringify(copia),r=await analizarRespaldo(copia);
    assert.equal(r.documentos,500);assert.equal(r.conteos.inventario,500);assert.equal(r.capacidad.automatica,false);
    assert.equal(r.candidataAComprobacionAutomatica,false);assert.equal(r.consultaProduccion,false);assert.equal(r.escribeDatos,false);
    assert.equal(JSON.stringify(copia),antes);
});
test('un respaldo de 398 documentos solo es candidato; uno de 399 exige recuperación separada',async()=>{
    assert.equal((await analizarRespaldo(copiaCompleta(398))).candidataAComprobacionAutomatica,true);
    assert.equal((await analizarRespaldo(copiaCompleta(399))).candidataAComprobacionAutomatica,false);
});
test('una firma incorrecta o una colección financiera ausente impiden considerar restaurable la copia',async()=>{
    const corrupta=copiaCompleta(1);corrupta.colecciones.inventario[0].data.stock=9;
    await assert.rejects(analizarRespaldo(corrupta),/SHA-256/);
    const parcial=copiaCompleta(1);delete parcial.colecciones.anticipos;delete parcial.conteos.anticipos;firmar(parcial);
    const r=await analizarRespaldo(parcial);assert.equal(r.candidataAComprobacionAutomatica,false);assert.ok(r.coleccionesFaltantes.includes('anticipos'));
});
