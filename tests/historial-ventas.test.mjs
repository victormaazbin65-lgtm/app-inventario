import test from 'node:test';
import {env,extract,read,vm,assert} from './sistema-fixture.mjs';

const cargar = (c, nombre) => vm.runInContext(extract(nombre), c);

test('Una devolución con anticipo distingue crédito, anticipo y dinero tanto en la vista previa como al guardar', async () => {
    const {c,base,el,line,alerts} = env();
    cargar(c,'puedeConsultarFinanzasInteligentes');
    c.carritoVentas=[line(2)];
    await c.procesarVentaMultiple();
    const venta = c.ventas[0];
    assert.ok(venta, alerts.join('\n'));
    Object.assign(venta,{clienteId:'c',anticipoAplicado:7,montoPagadoDinero:13,montoCobradoTotal:20,saldoPendiente:10});
    venta.asignacionFondosCobrado=c.core.calcularAsignacionFondos({ingresoTotal:30,costosProductos:10,gananciaNeta:20},20);
    base.set('ventas/'+venta.id,venta);
    base.set('clientes/c',{id:'c',saldoCredito:10,saldoAnticipos:0});
    vm.runInContext(read('finanzas-negocio.js'),c);
    el('devolucion-venta').value=venta.id;
    el('devolucion-item').value='0';
    el('devolucion-cantidad').value='2';
    el('devolucion-reingresar').checked=true;
    el('devolucion-metodo').value='efectivo';
    el('devolucion-motivo').value='Devolución de prueba';
    c.actualizarPreviewDevolucion();
    const preview=el('devolucion-preview').innerHTML;
    assert.match(preview,/reduce crédito: <strong>Q 10.00/);
    assert.match(preview,/anticipo que se restituye: <strong>Q 7.00/);
    assert.match(preview,/reembolso que sale: <strong>Q 13.00/);
    const efectivoAntes=base.get('sistema/config').saldosDinero.efectivo;
    await c.registrarDevolucionVenta();
    const d=base.get('ventas/'+venta.id).devoluciones.at(-1);
    assert.deepEqual([d.creditoReducido,d.anticipoRestaurado,d.reembolsoDinero],[10,7,13]);
    assert.equal(base.get('sistema/config').saldosDinero.efectivo,efectivoAntes-13);
});

test('Las líneas de un borrador con IDs repetidos conservan su precio y su costo individuales',async()=>{
    const {c,base,line,alerts}=env();
    cargar(c,'puedeConsultarFinanzasInteligentes');
    c.carritoVentas=[{...line(1),lineId:'vieja'}, {...line(2),lineId:'vieja',precioCobrado:3}];
    await c.procesarVentaMultiple();
    assert.equal(c.ventas.length,1,alerts.join('\n'));
    const venta=base.get('ventas/'+c.ventas[0].id);
    assert.equal(new Set(venta.detalleItems.map(i=>i.lineId)).size,2);
    assert.deepEqual(venta.detalleItems.map(i=>i.ingresoLineaOriginalCentavos),[1500,600]);
    assert.deepEqual(venta.detalleItems.map(i=>i.costoLineaOriginalCentavos),[500,1000]);
});

test('Un importe antiguo nulo usa precio y cantidad guardados, mientras un cero explícito sigue valiendo cero',()=>{
    const {c}=env();
    const base={qty:2,precioCobrado:15,costoBase:5,costoUnitarioReal:null,cantidadOriginalMilesimas:2000};
    for(const sinDato of [null,'',undefined]){
        const importe=c.core.calcularDevolucionLinea({...base,ingresoLineaOriginalCentavos:sinDato,costoLineaOriginalCentavos:sinDato},1);
        assert.equal(importe.ingresoDevuelto,15);
        assert.equal(importe.costoDevuelto,5);
    }
    const incluido=c.core.calcularDevolucionLinea({...base,ingresoLineaOriginalCentavos:0,costoLineaOriginalCentavos:0},1);
    assert.equal(incluido.ingresoDevuelto,0);
    assert.equal(incluido.costoDevuelto,0);
});

test('Un artículo fraccionado vuelve a su cantidad inicial en el resumen mensual',()=>{
    const {c}=env();
    const venta={detalleItems:[{rol:'principal',qty:'0.1'},{rol:'combo',qty:0.2},{rol:'material',qty:3}]};
    const resumen=c.aplicarVentaAResumen({items:0.1},venta);
    assert.equal(resumen.items,0.4);
    assert.equal(c.aplicarVentaAResumen(resumen,venta,-1).items,0.1);
});

test('Una venta sin versión contable válida se puede consultar y su reversión deja intactas las colecciones',async()=>{
    for (const version of [undefined,'versión desconocida',null]) {
        const {c,base}=env();
        cargar(c,'revertirVentaAtomica');
        base.set('ventas/antigua',{id:'antigua',versionCalculo:version,ingresoTotal:25});
        const antes=JSON.stringify([...base]);
        await assert.rejects(c.revertirVentaAtomica('antigua'),/historial anterior/);
        assert.equal(JSON.stringify([...base]),antes);
    }
});

test('El cambio de unidad en el servidor impide reingresar unidades anteriores en una devolución o anulación',async()=>{
    const {c,base,el,line,alerts}=env();
    cargar(c,'puedeConsultarFinanzasInteligentes');
    c.carritoVentas=[line(2)];
    await c.procesarVentaMultiple();
    const venta=c.ventas[0];
    assert.ok(venta,alerts.join('\n'));
    const producto=base.get('inventario/p1');
    Object.assign(producto,{unidadId:'centimetro',stock:800,ventasTotales:200});
    vm.runInContext(read('finanzas-negocio.js'),c);
    el('devolucion-venta').value=venta.id;
    el('devolucion-item').value='0';
    el('devolucion-cantidad').value='1';
    el('devolucion-reingresar').checked=true;
    el('devolucion-metodo').value='efectivo';
    el('devolucion-motivo').value='Prueba';
    const antes=JSON.stringify([...base]);
    await c.registrarDevolucionVenta();
    assert.match(alerts.at(-1),/unidad o el tipo/);
    assert.equal(JSON.stringify([...base]),antes);
    cargar(c,'revertirVentaAtomica');
    await assert.rejects(c.revertirVentaAtomica(venta.id),/unidad o el tipo/);
    assert.equal(JSON.stringify([...base]),antes);
    el('devolucion-reingresar').checked=false;
    await c.registrarDevolucionVenta();
    assert.equal(base.get('ventas/'+venta.id).ingresoTotal,15);
    assert.equal(base.get('inventario/p1').stock,800);
    assert.equal(base.get('inventario/p1').ventasTotales,200);
});

