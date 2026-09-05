(function (global) {
    'use strict';

    const CLAVES_FONDOS = Object.freeze(['costoProducto', 'costoLuzTinta', 'gananciaLibre', 'fondoImpuestos']);
    const METODOS_PAGO = Object.freeze({
        efectivo: { id: 'efectivo', nombre: 'Efectivo', ubicacion: 'efectivo' },
        transferencia: { id: 'transferencia', nombre: 'Transferencia', ubicacion: 'banco' },
        deposito: { id: 'deposito', nombre: 'Depósito', ubicacion: 'banco' }
    });

    const UNIDADES_BASE = Object.freeze([
        { id: 'pieza', nombre: 'Pieza', abreviatura: 'pza', paso: 1, divisible: false },
        { id: 'unidad', nombre: 'Unidad', abreviatura: 'unid', paso: 1, divisible: false },
        { id: 'par', nombre: 'Par', abreviatura: 'par', paso: 1, divisible: false },
        { id: 'juego', nombre: 'Juego', abreviatura: 'jgo', paso: 1, divisible: false },
        { id: 'docena', nombre: 'Docena', abreviatura: 'doc', paso: 0.01, divisible: true },
        { id: 'metro', nombre: 'Metro', abreviatura: 'm', paso: 0.01, divisible: true },
        { id: 'centimetro', nombre: 'Centímetro', abreviatura: 'cm', paso: 0.01, divisible: true },
        { id: 'milimetro', nombre: 'Milímetro', abreviatura: 'mm', paso: 0.01, divisible: true },
        { id: 'yarda', nombre: 'Yarda', abreviatura: 'yd', paso: 0.01, divisible: true },
        { id: 'pie', nombre: 'Pie', abreviatura: 'ft', paso: 0.01, divisible: true },
        { id: 'pulgada', nombre: 'Pulgada', abreviatura: 'in', paso: 0.01, divisible: true },
        { id: 'metro_cuadrado', nombre: 'Metro cuadrado', abreviatura: 'm²', paso: 0.01, divisible: true },
        { id: 'centimetro_cuadrado', nombre: 'Centímetro cuadrado', abreviatura: 'cm²', paso: 0.01, divisible: true },
        { id: 'kilogramo', nombre: 'Kilogramo', abreviatura: 'kg', paso: 0.001, divisible: true },
        { id: 'gramo', nombre: 'Gramo', abreviatura: 'g', paso: 0.01, divisible: true },
        { id: 'libra', nombre: 'Libra', abreviatura: 'lb', paso: 0.01, divisible: true },
        { id: 'onza', nombre: 'Onza', abreviatura: 'oz', paso: 0.01, divisible: true },
        { id: 'litro', nombre: 'Litro', abreviatura: 'L', paso: 0.01, divisible: true },
        { id: 'mililitro', nombre: 'Mililitro', abreviatura: 'ml', paso: 0.01, divisible: true },
        { id: 'galon', nombre: 'Galón', abreviatura: 'gal', paso: 0.01, divisible: true },
        { id: 'hora', nombre: 'Hora', abreviatura: 'h', paso: 0.01, divisible: true },
        { id: 'minuto', nombre: 'Minuto', abreviatura: 'min', paso: 1, divisible: false }
    ]);

    const CONFIGURACION_PREDETERMINADA = Object.freeze({
        version: 1,
        nombreNegocio: 'SubliCosturas',
        moneda: 'Q',
        porcentajeSAT: 5,
        nombreFondoProduccion: 'Luz y Tinta',
        margenObjetivo: 30,
        nombreManoObra: 'Mano de obra / creación',
        unidadesPersonalizadas: [],
        authPropietario: { habilitado: false, email: '', uid: '' }
    });

    function numeroFinito(valor, predeterminado = 0) {
        const numero = Number(valor);
        return Number.isFinite(numero) ? numero : predeterminado;
    }

    function redondearMoneda(valor) {
        return desdeCentavos(aCentavos(valor));
    }

    function redondearEnteroSimetrico(valor) {
        const numero = Number(valor);
        if (!Number.isFinite(numero)) return numero;
        const signo = Math.sign(numero);
        const magnitud = Math.abs(numero);
        const entero = Math.floor(magnitud);
        const fraccion = magnitud - entero;
        // Corrige únicamente el ruido binario junto a .5. El tope evita que la
        // tolerancia crezca hasta inventar unidades en magnitudes muy grandes.
        const tolerancia = Math.min(1e-7, Number.EPSILON * Math.max(1, magnitud) * 2);
        return signo * (fraccion >= 0.5 - tolerancia ? entero + 1 : entero);
    }

    function aCentavos(valor) {
        const numero = numeroFinito(valor);
        return redondearEnteroSimetrico(numero * 100);
    }

    function desdeCentavos(valor) {
        return numeroFinito(valor) / 100;
    }

    function normalizarMontoMoneda(valor, opciones = {}) {
        const numero = Number(valor);
        const permitirCero = Boolean(opciones && opciones.permitirCero);
        if (!Number.isFinite(numero)) throw new Error('El monto debe ser un número válido.');
        const centavos = aCentavos(numero);
        if (!Number.isSafeInteger(centavos)) throw new Error('Los montos son demasiado grandes para calcularse de forma segura.');
        if (centavos < 0) throw new Error('El monto no puede ser negativo.');
        if (!permitirCero && centavos === 0) throw new Error('El monto debe ser mayor que cero.');
        const normalizado = desdeCentavos(centavos);
        if (Math.abs(numero - normalizado) > 1e-9) throw new Error('El monto admite como máximo dos decimales.');
        return normalizado;
    }

    function redondearCostoUnitario(valor) {
        const numero = Number(valor);
        if (!Number.isFinite(numero) || numero < 0) throw new Error('El costo por unidad debe ser un número válido no negativo.');
        const micros = redondearEnteroSimetrico(numero * 1000000);
        if (!Number.isSafeInteger(micros)) throw new Error('El costo por unidad es demasiado grande para calcularse de forma segura.');
        return micros / 1000000;
    }

    function normalizarCostoUnitario(valor) {
        const numero = Number(valor);
        const normalizado = redondearCostoUnitario(numero);
        if (Math.abs(numero - normalizado) > 1e-12) throw new Error('El costo por unidad admite como máximo seis decimales.');
        return normalizado;
    }

    function aMilesimas(valor) {
        return redondearEnteroSimetrico(numeroFinito(valor) * 1000);
    }

    function desdeMilesimas(valor) {
        return numeroFinito(valor) / 1000;
    }

    function textoSeguro(valor, predeterminado, maximo = 80) {
        const texto = String(valor === undefined || valor === null ? '' : valor).trim();
        return (texto || predeterminado).slice(0, maximo);
    }

    function normalizarSimboloMoneda(valor) {
        const limpio = textoSeguro(valor, CONFIGURACION_PREDETERMINADA.moneda, 8)
            .replace(/[\u0000-\u001f\u007f<>&"'`\\]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        return limpio || CONFIGURACION_PREDETERMINADA.moneda;
    }

    function limitarPorcentaje(valor, predeterminado, maximo = 100) {
        const numero = Number(valor);
        if (!Number.isFinite(numero) || numero < 0 || numero > maximo) return predeterminado;
        return Math.round(numero * 100) / 100;
    }

    function normalizarConfiguracionNegocio(entrada) {
        const fuente = entrada && typeof entrada === 'object' ? entrada : {};
        const authFuente = fuente.authPropietario && typeof fuente.authPropietario === 'object'
            ? fuente.authPropietario
            : {};
        const personalizadas = Array.isArray(fuente.unidadesPersonalizadas)
            ? fuente.unidadesPersonalizadas.map(normalizarUnidadPersonalizada).filter(Boolean)
            : [];
        return {
            version: 1,
            nombreNegocio: textoSeguro(fuente.nombreNegocio, CONFIGURACION_PREDETERMINADA.nombreNegocio, 60),
            moneda: normalizarSimboloMoneda(fuente.moneda),
            porcentajeSAT: limitarPorcentaje(fuente.porcentajeSAT, CONFIGURACION_PREDETERMINADA.porcentajeSAT, 100),
            nombreFondoProduccion: textoSeguro(fuente.nombreFondoProduccion, CONFIGURACION_PREDETERMINADA.nombreFondoProduccion, 50),
            margenObjetivo: limitarPorcentaje(fuente.margenObjetivo, CONFIGURACION_PREDETERMINADA.margenObjetivo, 95),
            nombreManoObra: textoSeguro(fuente.nombreManoObra, CONFIGURACION_PREDETERMINADA.nombreManoObra, 50),
            unidadesPersonalizadas: personalizadas,
            authPropietario: {
                habilitado: Boolean(authFuente.habilitado && authFuente.uid && authFuente.email),
                email: String(authFuente.email || '').trim().toLowerCase().slice(0, 160),
                uid: String(authFuente.uid || '').trim().slice(0, 160)
            }
        };
    }

    function obtenerTasaSAT(configuracion) {
        return normalizarConfiguracionNegocio(configuracion).porcentajeSAT / 100;
    }

    function normalizarUnidadPersonalizada(unidad) {
        if (!unidad || typeof unidad !== 'object') return null;
        const nombre = textoSeguro(unidad.nombre, '', 40);
        if (!nombre) return null;
        const idBase = String(unidad.id || nombre)
            .replace(/^(personalizada_)+/i, '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        if (!idBase) return null;
        const divisible = Boolean(unidad.divisible);
        let paso = divisible ? numeroFinito(unidad.paso, 0.01) : 1;
        const pasoMilesimas = aMilesimas(paso);
        if (pasoMilesimas < 1 || pasoMilesimas > 1000) paso = divisible ? 0.01 : 1;
        else paso = divisible ? desdeMilesimas(pasoMilesimas) : 1;
        return {
            id: `personalizada_${idBase}`,
            nombre,
            abreviatura: textoSeguro(unidad.abreviatura, nombre.slice(0, 6), 10),
            paso,
            divisible
        };
    }

    function listarUnidades(configuracion) {
        const config = normalizarConfiguracionNegocio(configuracion);
        const mapa = new Map();
        [...UNIDADES_BASE, ...config.unidadesPersonalizadas].forEach(unidad => mapa.set(unidad.id, { ...unidad }));
        return Array.from(mapa.values());
    }

    function obtenerUnidad(id, configuracion) {
        const unidades = listarUnidades(configuracion);
        return unidades.find(unidad => unidad.id === id) || unidades.find(unidad => unidad.id === 'pieza');
    }

    function normalizarCantidad(valor, unidad) {
        const cantidad = Number(valor);
        if (!Number.isFinite(cantidad) || cantidad < 0) throw new Error('La cantidad debe ser un número válido no negativo.');
        const definicion = unidad || UNIDADES_BASE[0];
        const cantidadMilesimas = aMilesimas(cantidad);
        if (!Number.isSafeInteger(cantidadMilesimas)) throw new Error('La cantidad es demasiado grande para calcularse de forma segura.');
        if (Math.abs(cantidad - desdeMilesimas(cantidadMilesimas)) > 1e-9) {
            throw new Error('La cantidad admite como máximo tres decimales.');
        }
        if (!definicion.divisible && cantidadMilesimas % 1000 !== 0) {
            throw new Error(`La unidad “${definicion.nombre}” solo admite cantidades enteras.`);
        }
        const pasoMilesimas = definicion.divisible ? Math.max(1, aMilesimas(definicion.paso || 0.01)) : 1000;
        if (cantidadMilesimas % pasoMilesimas !== 0) {
            throw new Error(`La unidad “${definicion.nombre}” admite cantidades en pasos de ${desdeMilesimas(pasoMilesimas)}.`);
        }
        return desdeMilesimas(cantidadMilesimas);
    }

    function calcularIngresoConvertido(cantidadCompra, contenidoPorCompra, costoIngresado, tipoCosto, unidad) {
        const compras = Number(cantidadCompra);
        const contenido = Number(contenidoPorCompra);
        const costo = tipoCosto === 'total'
            ? normalizarMontoMoneda(costoIngresado, { permitirCero: true })
            : normalizarCostoUnitario(costoIngresado);
        if (!Number.isFinite(compras) || compras <= 0) throw new Error('La cantidad de lotes o paquetes debe ser mayor que cero.');
        if (!Number.isInteger(compras)) throw new Error('La cantidad de lotes o paquetes debe ser un número entero.');
        if (!Number.isFinite(contenido) || contenido <= 0) throw new Error('Las unidades por lote o paquete deben ser mayores que cero.');
        if (!Number.isFinite(costo) || costo < 0) throw new Error('El costo no puede ser negativo.');
        const contenidoNormalizado = normalizarCantidad(contenido, unidad);
        const cantidadBase = normalizarCantidad(compras * contenidoNormalizado, unidad);
        if (cantidadBase <= 0) throw new Error('La conversión no produjo existencias válidas.');
        const costoBase = tipoCosto === 'total' ? costo / cantidadBase : costo;
        if (!Number.isFinite(costoBase) || costoBase < 0) throw new Error('El costo convertido no es válido.');
        return { cantidadBase, costoBase: redondearCostoUnitario(costoBase) };
    }

    function crearReferenciaLineaVenta(item, indice) {
        const linea = item && typeof item === 'object' ? item : {};
        return {
            lineId: String(linea.lineId || ''),
            indice: Number.isInteger(indice) ? indice : -1,
            idProd: String(linea.idProd || ''),
            nombre: String(linea.nombre || ''),
            unidadId: String(linea.unidadId || ''),
            isService: Boolean(linea.isService),
            cantidadMilesimas: aMilesimas(linea.qty),
            cantidadOriginalMilesimas: Math.trunc(numeroFinito(linea.cantidadOriginalMilesimas)),
            ingresoLineaOriginalCentavos: Math.trunc(numeroFinito(linea.ingresoLineaOriginalCentavos)),
            costoLineaOriginalCentavos: Math.trunc(numeroFinito(linea.costoLineaOriginalCentavos)),
            precioCentavos: aCentavos(linea.precioCobrado),
            costoMicros: Math.round(numeroFinito(linea.costoUnitarioReal, numeroFinito(linea.costoBase)) * 1000000)
        };
    }

    function lineaCoincideConReferencia(item, referencia) {
        if (!item || !referencia) return false;
        if (referencia.lineId && String(item.lineId || '') !== String(referencia.lineId)) return false;
        const actual = crearReferenciaLineaVenta(item, referencia.indice);
        return actual.idProd === String(referencia.idProd || '')
            && actual.nombre === String(referencia.nombre || '')
            && actual.unidadId === String(referencia.unidadId || '')
            && actual.isService === Boolean(referencia.isService)
            && actual.cantidadMilesimas === Number(referencia.cantidadMilesimas)
            && actual.cantidadOriginalMilesimas === Number(referencia.cantidadOriginalMilesimas)
            && actual.ingresoLineaOriginalCentavos === Number(referencia.ingresoLineaOriginalCentavos)
            && actual.costoLineaOriginalCentavos === Number(referencia.costoLineaOriginalCentavos)
            && actual.precioCentavos === Number(referencia.precioCentavos)
            && actual.costoMicros === Number(referencia.costoMicros);
    }

    function localizarLineaVenta(detalleItems, referencia) {
        const detalle = Array.isArray(detalleItems) ? detalleItems : [];
        if (!referencia) return -1;
        if (referencia.lineId) return detalle.findIndex(item => lineaCoincideConReferencia(item, referencia));
        const indice = Number(referencia.indice);
        return Number.isInteger(indice) && indice >= 0 && indice < detalle.length
            && lineaCoincideConReferencia(detalle[indice], referencia) ? indice : -1;
    }

    function tramoProporcionalCentavos(totalCentavos, cantidadOriginalMilesimas, cantidadDisponibleMilesimas, cantidadDevueltaMilesimas) {
        const total = Math.max(0, Math.trunc(numeroFinito(totalCentavos)));
        const original = Math.trunc(numeroFinito(cantidadOriginalMilesimas));
        const disponible = Math.trunc(numeroFinito(cantidadDisponibleMilesimas));
        const devuelta = Math.trunc(numeroFinito(cantidadDevueltaMilesimas));
        if (original <= 0 || disponible <= 0 || disponible > original || devuelta <= 0 || devuelta > disponible) {
            throw new Error('La cantidad devuelta no coincide con la línea original.');
        }
        const devueltoAntes = original - disponible;
        const objetivoAntes = Math.round(total * (devueltoAntes / original));
        const objetivoDespues = devuelta === disponible
            ? total
            : Math.round(total * ((devueltoAntes + devuelta) / original));
        return Math.max(0, objetivoDespues - objetivoAntes);
    }

    function calcularDevolucionLinea(item, cantidadDevuelta) {
        if (!item || typeof item !== 'object') throw new Error('La línea de venta no es válida.');
        const disponible = aMilesimas(item.qty);
        const devuelta = aMilesimas(cantidadDevuelta);
        const originalGuardada = Math.trunc(numeroFinito(item.cantidadOriginalMilesimas));
        const original = originalGuardada >= disponible && originalGuardada > 0 ? originalGuardada : disponible;
        const ingresoGuardado = Number(item.ingresoLineaOriginalCentavos);
        const costoGuardado = Number(item.costoLineaOriginalCentavos);
        const ingresoTotal = Number.isSafeInteger(ingresoGuardado) && ingresoGuardado >= 0
            ? ingresoGuardado
            : aCentavos(desdeMilesimas(original) * numeroFinito(item.precioCobrado));
        const costoUnitario = numeroFinito(item.costoUnitarioReal, numeroFinito(item.costoBase));
        const costoTotal = Number.isSafeInteger(costoGuardado) && costoGuardado >= 0
            ? costoGuardado
            : aCentavos(desdeMilesimas(original) * costoUnitario);
        const ingresoDevueltoCentavos = tramoProporcionalCentavos(ingresoTotal, original, disponible, devuelta);
        const costoDevueltoCentavos = tramoProporcionalCentavos(costoTotal, original, disponible, devuelta);
        return {
            cantidadOriginalMilesimas: original,
            cantidadDevueltaMilesimas: devuelta,
            cantidadRestante: desdeMilesimas(disponible - devuelta),
            ingresoLineaOriginalCentavos: ingresoTotal,
            costoLineaOriginalCentavos: costoTotal,
            ingresoDevueltoCentavos,
            costoDevueltoCentavos,
            ingresoDevuelto: desdeCentavos(ingresoDevueltoCentavos),
            costoDevuelto: desdeCentavos(costoDevueltoCentavos)
        };
    }

    function calcularIngresoSimple(cantidadIngresada, costoUnitario, unidad) {
        const cantidadBase = normalizarCantidad(cantidadIngresada, unidad);
        const costoBase = normalizarCostoUnitario(costoUnitario);
        if (cantidadBase <= 0) throw new Error('La cantidad que ingresarás debe ser mayor que cero.');
        if (!Number.isFinite(costoBase) || costoBase < 0) throw new Error('El costo por unidad debe ser un número válido no negativo.');
        return { cantidadBase, costoBase: redondearCostoUnitario(costoBase) };
    }

    function calcularDesgloseFinanciero(detalleItems, costoProduccion, costoEnvio, pideFactura, configuracion, costoManoObra = 0) {
        const items = Array.isArray(detalleItems) ? detalleItems : [];
        const produccion = normalizarMontoMoneda(costoProduccion, { permitirCero: true });
        const envio = normalizarMontoMoneda(costoEnvio, { permitirCero: true });
        const manoObra = normalizarMontoMoneda(costoManoObra, { permitirCero: true });
        let ingresoTotal = 0;
        let costosProductos = 0;
        for (const item of items) {
            const cantidad = Number(item.qty);
            const precio = normalizarMontoMoneda(item.precioCobrado, { permitirCero: true });
            const costo = Number(item.costoUnitarioReal === undefined || item.costoUnitarioReal === null ? item.costoBase : item.costoUnitarioReal);
            if (![cantidad, precio, costo].every(Number.isFinite) || cantidad <= 0 || precio < 0 || costo < 0) {
                throw new Error(`Hay cantidades, precios o costos inválidos en “${item.nombre || 'un artículo'}”.`);
            }
            ingresoTotal += cantidad * precio;
            costosProductos += cantidad * costo;
        }
        if (!Number.isFinite(ingresoTotal) || !Number.isFinite(costosProductos)
            || !Number.isSafeInteger(aCentavos(ingresoTotal)) || !Number.isSafeInteger(aCentavos(costosProductos))) {
            throw new Error('Los montos son demasiado grandes para calcularse de forma segura.');
        }
        ingresoTotal = redondearMoneda(ingresoTotal);
        costosProductos = redondearMoneda(costosProductos);
        const costoTinta = redondearMoneda(produccion);
        const costoEnvioNormalizado = redondearMoneda(envio);
        const costoManoObraNormalizado = redondearMoneda(manoObra);
        const config = normalizarConfiguracionNegocio(configuracion);
        const tasaSAT = pideFactura ? config.porcentajeSAT / 100 : 0;
        const impuestoSAT = pideFactura ? redondearMoneda(ingresoTotal * tasaSAT) : 0;
        const centavosGastos = [costosProductos, costoTinta, costoEnvioNormalizado, costoManoObraNormalizado, impuestoSAT]
            .reduce((total, componente) => {
                const siguiente = total + aCentavos(componente);
                if (!Number.isSafeInteger(siguiente)) throw new Error('Los gastos son demasiado grandes para calcularse de forma segura.');
                return siguiente;
            }, 0);
        const centavosGanancia = aCentavos(ingresoTotal) - centavosGastos;
        if (!Number.isSafeInteger(centavosGanancia)) throw new Error('La ganancia excede el límite numérico seguro.');
        const totalGastos = desdeCentavos(centavosGastos);
        const gananciaNeta = desdeCentavos(centavosGanancia);
        const margen = ingresoTotal > 0 ? gananciaNeta / ingresoTotal : 0;
        if (![impuestoSAT, totalGastos, gananciaNeta, margen].every(Number.isFinite)) {
            throw new Error('El resultado financiero excede el límite numérico seguro.');
        }
        return {
            ingresoTotal,
            costosProductos,
            costoTinta,
            costoEnvio: costoEnvioNormalizado,
            costoManoObra: costoManoObraNormalizado,
            impuestoSAT,
            porcentajeSAT: config.porcentajeSAT,
            tasaSAT,
            nombreProduccion: config.nombreFondoProduccion,
            nombreManoObra: config.nombreManoObra,
            totalGastos,
            gananciaNeta,
            margen,
            pideFactura: Boolean(pideFactura)
        };
    }

    function normalizarFondos(fondos) {
        const fuente = fondos && typeof fondos === 'object' ? fondos : {};
        return CLAVES_FONDOS.reduce((salida, clave) => {
            salida[clave] = redondearMoneda(fuente[clave]);
            return salida;
        }, {});
    }

    function totalFondos(fondos) {
        return redondearMoneda(CLAVES_FONDOS.reduce((total, clave) => total + numeroFinito(fondos && fondos[clave]), 0));
    }

    function normalizarSaldosDinero(saldos, totalEsperado) {
        const esperado = redondearMoneda(totalEsperado);
        if (!saldos || typeof saldos !== 'object' || !saldos.inicializado) {
            return { efectivo: esperado, banco: 0, inicializado: true, migradoAutomaticamente: true };
        }
        const efectivo = redondearMoneda(Math.max(0, numeroFinito(saldos.efectivo)));
        const banco = redondearMoneda(Math.max(0, numeroFinito(saldos.banco)));
        return {
            efectivo,
            banco,
            inicializado: true,
            migradoAutomaticamente: Boolean(saldos.migradoAutomaticamente)
        };
    }

    function ubicacionMetodoPago(metodo) {
        return (METODOS_PAGO[metodo] || METODOS_PAGO.efectivo).ubicacion;
    }

    function calcularTramoProporcionalMoneda(total, base, aplicadoAntes, nuevoAplicado) {
        const totalCentavos = aCentavos(normalizarMontoMoneda(total, { permitirCero: true }));
        const baseCentavos = aCentavos(normalizarMontoMoneda(base, { permitirCero: true }));
        const anteriorCentavos = aCentavos(normalizarMontoMoneda(aplicadoAntes, { permitirCero: true }));
        const nuevoCentavos = aCentavos(normalizarMontoMoneda(nuevoAplicado, { permitirCero: true }));
        if (baseCentavos <= 0) {
            if (anteriorCentavos === 0 && nuevoCentavos === 0) return { tramo: 0, aplicadoAcumulado: 0, restante: desdeCentavos(totalCentavos) };
            throw new Error('La base del prorrateo debe ser mayor que cero.');
        }
        if (anteriorCentavos > baseCentavos || nuevoCentavos > baseCentavos - anteriorCentavos) {
            throw new Error('El tramo supera el saldo disponible de la base.');
        }
        const acumuladoCentavos = anteriorCentavos + nuevoCentavos;
        const objetivoAnterior = Math.round(totalCentavos * (anteriorCentavos / baseCentavos));
        const objetivoAcumulado = acumuladoCentavos === baseCentavos
            ? totalCentavos
            : Math.round(totalCentavos * (acumuladoCentavos / baseCentavos));
        return {
            tramo: desdeCentavos(objetivoAcumulado - objetivoAnterior),
            aplicadoAcumulado: desdeCentavos(acumuladoCentavos),
            restante: desdeCentavos(totalCentavos - objetivoAcumulado)
        };
    }

    function calcularReembolsoPagos(pagos, montoEsperado) {
        const esperado = normalizarMontoMoneda(montoEsperado, { permitirCero: true });
        const totales = { efectivo: 0, banco: 0 };
        for (const pago of Array.isArray(pagos) ? pagos : []) {
            if (!pago || typeof pago !== 'object') throw new Error('El historial contiene un pago inválido.');
            const numero = Number(pago.monto);
            if (!Number.isFinite(numero) || numero < 0) throw new Error('El historial contiene un pago inválido.');
            if (numero === 0) continue;
            const monto = normalizarMontoMoneda(numero);
            const ubicacionDeclarada = pago.ubicacion === 'banco' || pago.ubicacion === 'efectivo' ? pago.ubicacion : '';
            const ubicacionMetodo = METODOS_PAGO[String(pago.metodo || '').toLowerCase()]?.ubicacion || '';
            const ubicacion = ubicacionDeclarada || ubicacionMetodo;
            if (!ubicacion || (ubicacionDeclarada && ubicacionMetodo && ubicacionDeclarada !== ubicacionMetodo)) {
                throw new Error('El historial contiene un método o ubicación de pago inválido.');
            }
            totales[ubicacion] += aCentavos(monto);
            if (!Number.isSafeInteger(totales[ubicacion])) throw new Error('El historial de pagos es demasiado grande para calcularse de forma segura.');
        }
        const totalCentavos = totales.efectivo + totales.banco;
        if (!Number.isSafeInteger(totalCentavos)) throw new Error('El historial de pagos es demasiado grande para calcularse de forma segura.');
        if (totalCentavos !== aCentavos(esperado)) {
            throw new Error('El historial de pagos no coincide con el dinero cobrado; la anulación se detuvo para revisión.');
        }
        return {
            efectivo: desdeCentavos(totales.efectivo),
            banco: desdeCentavos(totales.banco),
            total: desdeCentavos(totalCentavos)
        };
    }

    function validarAsignacionFondos(asignacion, montoEsperado) {
        if (!asignacion || typeof asignacion !== 'object' || Array.isArray(asignacion)) {
            throw new Error('La huella de fondos de la venta no existe o es inválida.');
        }
        const normalizada = {};
        let totalCentavos = 0;
        for (const clave of CLAVES_FONDOS) {
            const numero = Number(asignacion[clave]);
            if (!Number.isFinite(numero)) throw new Error(`La huella del fondo ${clave} es inválida.`);
            const centavos = aCentavos(numero);
            if (!Number.isSafeInteger(centavos)) throw new Error('La huella de fondos es demasiado grande para calcularse de forma segura.');
            if (Math.abs(numero - desdeCentavos(centavos)) > 1e-9) throw new Error(`La huella del fondo ${clave} contiene fracciones inválidas de centavo.`);
            totalCentavos += centavos;
            if (!Number.isSafeInteger(totalCentavos)) throw new Error('La huella de fondos es demasiado grande para calcularse de forma segura.');
            normalizada[clave] = desdeCentavos(centavos);
        }
        const esperadoCentavos = aCentavos(normalizarMontoMoneda(montoEsperado, { permitirCero: true }));
        if (totalCentavos !== esperadoCentavos) {
            throw new Error('La huella de fondos no coincide con el dinero cobrado; la operación se detuvo para revisión.');
        }
        return normalizada;
    }

    function distribuirCentavos(totalCentavos, pesos) {
        const entradas = Object.entries(pesos || {});
        const salida = Object.fromEntries(entradas.map(([clave]) => [clave, 0]));
        const objetivo = Math.trunc(numeroFinito(totalCentavos));
        if (!entradas.length || objetivo === 0) return salida;
        const signo = objetivo < 0 ? -1 : 1;
        const magnitud = Math.abs(objetivo);
        let pesosValidos = entradas.map(([, valor]) => Math.abs(numeroFinito(valor)));
        let sumaPesos = pesosValidos.reduce((total, valor) => total + valor, 0);
        if (sumaPesos === 0) {
            pesosValidos = entradas.map(() => 1);
            sumaPesos = entradas.length;
        }
        const cuotas = entradas.map(([clave], indice) => {
            const exacta = magnitud * (pesosValidos[indice] / sumaPesos);
            const entera = Math.floor(exacta);
            salida[clave] = signo * entera;
            return { clave, fraccion: exacta - entera, indice };
        });
        let pendiente = magnitud - cuotas.reduce((total, cuota) => total + Math.abs(salida[cuota.clave]), 0);
        cuotas.sort((a, b) => (b.fraccion - a.fraccion) || (a.indice - b.indice));
        for (let indice = 0; indice < pendiente; indice += 1) {
            salida[cuotas[indice % cuotas.length].clave] += signo;
        }
        return salida;
    }

    function objetivoProporcionalExacto(componentes, acumuladoCentavos, totalCentavos) {
        const objetivo = Math.trunc(numeroFinito(acumuladoCentavos));
        const total = Math.trunc(numeroFinito(totalCentavos));
        const salida = Object.fromEntries(CLAVES_FONDOS.map(clave => [clave, 0]));
        if (total <= 0 || objetivo <= 0) return salida;
        CLAVES_FONDOS.forEach(clave => {
            salida[clave] = Math.round(numeroFinito(componentes && componentes[clave]) * (objetivo / total));
        });
        const asignado = CLAVES_FONDOS.reduce((suma, clave) => suma + salida[clave], 0);
        const diferencia = objetivo - asignado;
        if (diferencia !== 0) {
            const claveMayor = [...CLAVES_FONDOS].sort((a, b) =>
                Math.abs(numeroFinito(componentes && componentes[b])) - Math.abs(numeroFinito(componentes && componentes[a]))
            )[0];
            salida[claveMayor] += diferencia;
        }
        return salida;
    }

    function calcularAsignacionFondos(desglose, montoPagado) {
        const ingresoCentavos = Math.max(0, aCentavos(desglose && desglose.ingresoTotal));
        const pagadoCentavos = Math.min(ingresoCentavos, Math.max(0, aCentavos(montoPagado)));
        const componentesFinales = {
            costoProducto: aCentavos(desglose && desglose.costosProductos),
            costoLuzTinta: aCentavos(
                numeroFinito(desglose && desglose.costoTinta)
                + numeroFinito(desglose && desglose.costoManoObra)
                + numeroFinito(desglose && desglose.costoEnvio)
            ),
            fondoImpuestos: aCentavos(desglose && desglose.impuestoSAT),
            gananciaLibre: aCentavos(desglose && desglose.gananciaNeta)
        };
        if (ingresoCentavos === 0 || pagadoCentavos === 0) {
            return Object.fromEntries(CLAVES_FONDOS.map(clave => [clave, 0]));
        }
        if (pagadoCentavos === ingresoCentavos) {
            return Object.fromEntries(CLAVES_FONDOS.map(clave => [clave, desdeCentavos(componentesFinales[clave])]));
        }
        const objetivo = objetivoProporcionalExacto(componentesFinales, pagadoCentavos, ingresoCentavos);
        return Object.fromEntries(CLAVES_FONDOS.map(clave => [clave, desdeCentavos(objetivo[clave])]));
    }

    function restarAsignaciones(nueva, anterior) {
        return Object.fromEntries(CLAVES_FONDOS.map(clave => [
            clave,
            desdeCentavos(aCentavos(nueva && nueva[clave]) - aCentavos(anterior && anterior[clave]))
        ]));
    }

    function sumarAsignacion(fondos, asignacion, signo = 1) {
        const salida = normalizarFondos(fondos);
        CLAVES_FONDOS.forEach(clave => {
            salida[clave] = desdeCentavos(aCentavos(salida[clave]) + (signo * aCentavos(asignacion && asignacion[clave])));
        });
        return salida;
    }

    function totalAsignacion(asignacion) {
        return desdeCentavos(CLAVES_FONDOS.reduce((total, clave) => total + aCentavos(asignacion && asignacion[clave]), 0));
    }

    function calcularRestitucionPrestamo(desgloseOriginal, montoPrestamo, devueltoAntes, nuevoAbono) {
        const total = aCentavos(montoPrestamo);
        const anterior = Math.max(0, aCentavos(devueltoAntes));
        const acumulado = Math.min(total, anterior + Math.max(0, aCentavos(nuevoAbono)));
        if (total <= 0 || acumulado <= anterior) throw new Error('El abono del préstamo debe ser mayor que cero.');
        const componentes = Object.fromEntries(CLAVES_FONDOS.map(clave => [clave, aCentavos(desgloseOriginal && desgloseOriginal[clave])]));
        const objetivoCentavos = objetivoProporcionalExacto(componentes, acumulado, total);
        const objetivoAnteriorCentavos = objetivoProporcionalExacto(componentes, anterior, total);
        const objetivo = Object.fromEntries(CLAVES_FONDOS.map(clave => [clave, desdeCentavos(objetivoCentavos[clave])]));
        const objetivoAnterior = Object.fromEntries(CLAVES_FONDOS.map(clave => [clave, desdeCentavos(objetivoAnteriorCentavos[clave])]));
        return {
            montoAplicado: desdeCentavos(acumulado - anterior),
            devueltoAcumulado: desdeCentavos(acumulado),
            restauracion: restarAsignaciones(objetivo, objetivoAnterior),
            pagado: acumulado === total
        };
    }

    function validarCliente(cliente) {
        const fuente = cliente && typeof cliente === 'object' ? cliente : {};
        const nombres = textoSeguro(fuente.nombres, '', 80);
        const apellidos = textoSeguro(fuente.apellidos, '', 80);
        if (!nombres && !apellidos) throw new Error('Escribe al menos un nombre o apellido del cliente.');
        return {
            id: String(fuente.id || '').trim(),
            nombres,
            apellidos,
            nombreCompleto: `${nombres} ${apellidos}`.trim().toUpperCase(),
            telefono: textoSeguro(fuente.telefono, '', 30),
            direccion: textoSeguro(fuente.direccion, '', 220),
            nit: textoSeguro(fuente.nit, 'C/F', 30),
            notas: textoSeguro(fuente.notas, '', 500),
            limiteCredito: normalizarMontoMoneda(fuente.limiteCredito === '' || fuente.limiteCredito === undefined ? 0 : fuente.limiteCredito, { permitirCero: true })
        };
    }

    const api = Object.freeze({
        CLAVES_FONDOS,
        CONFIGURACION_PREDETERMINADA,
        METODOS_PAGO,
        UNIDADES_BASE,
        aCentavos,
        desdeCentavos,
        normalizarMontoMoneda,
        redondearCostoUnitario,
        normalizarCostoUnitario,
        aMilesimas,
        desdeMilesimas,
        redondearMoneda,
        normalizarConfiguracionNegocio,
        obtenerTasaSAT,
        listarUnidades,
        obtenerUnidad,
        normalizarCantidad,
        calcularIngresoConvertido,
        calcularIngresoSimple,
        crearReferenciaLineaVenta,
        localizarLineaVenta,
        calcularDevolucionLinea,
        calcularDesgloseFinanciero,
        normalizarFondos,
        totalFondos,
        normalizarSaldosDinero,
        ubicacionMetodoPago,
        calcularTramoProporcionalMoneda,
        calcularReembolsoPagos,
        validarAsignacionFondos,
        distribuirCentavos,
        calcularAsignacionFondos,
        restarAsignaciones,
        sumarAsignacion,
        totalAsignacion,
        calcularRestitucionPrestamo,
        validarCliente
    });

    global.SubliNegocioCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
