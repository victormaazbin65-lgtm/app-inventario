(function (global) {
    'use strict';

    function numero(valor) {
        const n = Number(valor);
        return Number.isFinite(n) ? n : 0;
    }

    function normalizarTexto(valor) {
        return String(valor ?? '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9ñ]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function contiene(texto, palabras) {
        return palabras.some(p => texto.includes(normalizarTexto(p)));
    }

    const CATALOGO = Object.freeze([
        {
            id: 'prestamo_registrar', titulo: 'Registrar un préstamo', pestana: 'caja',
            palabras: ['prestamo','prestar','dinero prestado','entregar dinero','registrar prestamo'],
            fuertes: ['como prestar','registrar prestamo','hacer prestamo','prestar dinero','donde presto'],
            pasos: [
                'Entra a Inicio y abre Panel de Finanzas / Caja.',
                'Abre “Dinero prestado que regresará”.',
                'Escribe persona, monto, origen (Efectivo o Banco), fecha esperada y motivo.',
                'Revisa el disponible del origen. El sistema no permite prestar más de lo disponible ni usar el fondo SAT protegido.',
                'Pulsa “Registrar préstamo”. El dinero se descuenta del origen elegido y queda como saldo por cobrar.'
            ]
        },
        {
            id: 'prestamo_devolver', titulo: 'Registrar la devolución de un préstamo', pestana: 'caja',
            palabras: ['prestamo','devolver','regresar','abonar','pagar prestamo','devolucion prestamo'],
            fuertes: ['regresar prestamo','devolver prestamo','abonar prestamo','pagar prestamo','registrar devolucion prestamo'],
            pasos: [
                'Entra a Inicio → Panel de Finanzas / Caja → “Dinero prestado que regresará”.',
                'Busca a la persona y pulsa “Registrar devolución”.',
                'Escribe cuánto regresó y cómo regresó: efectivo, transferencia o depósito.',
                'Puedes registrar devoluciones parciales. El sistema conserva el saldo pendiente.',
                'La devolución restaura proporcionalmente los mismos fondos internos de los que salió el préstamo.'
            ]
        },
        {
            id: 'ingreso_producto', titulo: 'Ingresar producto o aumentar existencias', pestana: 'ingreso',
            palabras: ['ingreso','ingresar producto','agregar inventario','aumentar stock','existencia','surtir inventario'],
            fuertes: ['como ingreso','ingresar producto','agregar producto','aumentar existencias','meter inventario'],
            pasos: [
                'Abre Ingreso.',
                'Elige si es un producto nuevo o uno que ya existe.',
                'Indica la cantidad que realmente entrará al inventario. Si compraste por paquete o lote, usa el modo de ingreso agrupado.',
                'La unidad de medida es opcional y se usa como información/descripción cuando corresponde.',
                'El código de inventario también es opcional: puedes asignarlo al ingresar o después desde Inventario.',
                'Confirma el ingreso; el historial conservará el movimiento.'
            ]
        },
        {
            id: 'codigo_inventario', titulo: 'Código de inventario', pestana: 'inventario',
            palabras: ['codigo','codigo inventario','etiqueta','identificar producto','numero producto'],
            fuertes: ['asignar codigo','codigo de inventario','producto sin codigo','cambiar codigo'],
            pasos: [
                'Cada producto físico puede tener un código único para identificarlo.',
                'Puedes escribir un código opcional durante Ingreso o asignarlo después desde Inventario.',
                'El sistema valida que el código no esté ocupado y mantiene un registro permanente para evitar reutilizaciones accidentales.',
                'Si un producto ya tiene un código permanente, no debe sustituirse desde un nuevo ingreso.'
            ]
        },
        {
            id: 'venta', titulo: 'Registrar una venta', pestana: 'ventas',
            palabras: ['venta','vender','cobrar','venta contado','procesar venta'],
            fuertes: ['como vender','hacer venta','registrar venta','venta al contado'],
            pasos: [
                'Abre Ventas y agrega los productos o servicios al carrito.',
                'Revisa cantidades, precios y costos antes de procesar.',
                'Elige el tipo de cobro y el método de pago.',
                'Activa factura únicamente cuando el cliente la solicite; entonces se aplica la tasa SAT configurada.',
                'Procesa la venta. El sistema actualiza existencias, dinero, fondos y el historial de forma coordinada.'
            ]
        },
        {
            id: 'venta_credito', titulo: 'Venta a crédito y abonos', pestana: 'ventas',
            palabras: ['credito','venta credito','fiado','saldo cliente','abono credito'],
            fuertes: ['venta a credito','vender al credito','registrar abono','cliente debe','pagar credito'],
            pasos: [
                'En Ventas selecciona el cobro a crédito y registra el pago inicial si existe.',
                'El sistema guarda lo cobrado y el saldo pendiente por separado.',
                'Los abonos posteriores se registran desde Caja/Finanzas sobre la cuenta pendiente.',
                'Cada abono aumenta los fondos solamente por el dinero realmente recibido y reduce el saldo del cliente.'
            ]
        },
        {
            id: 'cotizacion', titulo: 'Crear una cotización', pestana: 'cotizacion',
            palabras: ['cotizacion','cotizar','presupuesto','precio cliente'],
            fuertes: ['hacer cotizacion','crear cotizacion','como cotizar'],
            pasos: [
                'Abre Cotización y agrega productos o servicios.',
                'Define cantidades, precios y los datos del cliente cuando correspondan.',
                'Guarda la cotización para conservar el historial.',
                'Cuando el cliente confirme, puedes convertir el trabajo al flujo de venta sin perder la referencia.'
            ]
        },
        {
            id: 'surtido', titulo: 'Usar Por Surtir', pestana: 'alertas',
            palabras: ['surtir','por surtir','proveedor','distribuidor','agotado','stock bajo'],
            fuertes: ['que debo surtir','por proveedor','ver distribuidor','productos agotados','como surtir'],
            pasos: [
                'Abre Por Surtir.',
                'Puedes revisar pendientes por producto o el catálogo completo por proveedor/distribuidor.',
                'Los agotados aparecen primero, después los de stock bajo y luego los que están bien.',
                'Filtra por proveedor, busca por nombre/código y activa “Solo pendientes” cuando quieras preparar una compra.'
            ]
        },
        {
            id: 'devolucion_venta', titulo: 'Registrar una devolución de venta', pestana: 'caja',
            palabras: ['devolucion','devolver venta','cliente devuelve','reembolso','regresar producto'],
            fuertes: ['devolucion de venta','cliente devuelve','reembolsar venta','devolver producto'],
            pasos: [
                'Entra a Caja/Finanzas y abre Devoluciones.',
                'Selecciona la venta y el artículo correspondiente.',
                'Indica la cantidad devuelta y si debe reingresar al inventario.',
                'Si corresponde devolver dinero, selecciona el método del reembolso.',
                'Registra el motivo. El sistema ajustará existencias y dinero conservando la bitácora.'
            ]
        },
        {
            id: 'anticipo', titulo: 'Registrar o devolver un anticipo', pestana: 'caja',
            palabras: ['anticipo','adelanto','cliente adelanta','devolver anticipo'],
            fuertes: ['registrar anticipo','cliente da anticipo','devolver anticipo'],
            pasos: [
                'Desde Caja/Finanzas registra el anticipo asociado a un cliente guardado.',
                'Indica monto, método y motivo. El anticipo entra al dinero disponible pero todavía no se cuenta como venta ni ganancia.',
                'Cuando se use en una venta, el sistema aplica el saldo correspondiente.',
                'Si debes regresarlo, utiliza la opción Devolver del anticipo pendiente.'
            ]
        },
        {
            id: 'traslado', titulo: 'Mover dinero entre efectivo y banco', pestana: 'caja',
            palabras: ['traslado','mover dinero','efectivo banco','banco efectivo','transferir caja'],
            fuertes: ['mover de efectivo a banco','mover de banco a efectivo','trasladar dinero'],
            pasos: [
                'Abre Caja/Finanzas y utiliza Traslado entre cuentas.',
                'Elige la dirección: efectivo → banco o banco → efectivo.',
                'Escribe monto y motivo.',
                'El traslado solo cambia la ubicación del dinero; no crea ingreso, gasto ni ganancia.'
            ]
        },
        {
            id: 'retiro', titulo: 'Registrar un retiro de dinero', pestana: 'caja',
            palabras: ['retiro','sacar dinero','retirar ganancia','retirar fondos','sacar caja'],
            fuertes: ['registrar retiro','sacar dinero','retiro inteligente'],
            pasos: [
                'Abre Caja/Finanzas y usa el retiro inteligente.',
                'Selecciona de dónde sale el dinero y escribe el monto.',
                'El modo inteligente protege primero el fondo SAT y muestra el desglose antes de confirmar.',
                'El sistema vuelve a validar los saldos en la transacción para evitar negativos o cambios desde otro dispositivo.'
            ]
        },
        {
            id: 'merma', titulo: 'Registrar pérdida o merma', pestana: 'caja',
            palabras: ['merma','perdida','producto dañado','se daño','faltante inventario'],
            fuertes: ['registrar merma','producto dañado','perdida inventario'],
            pasos: [
                'Entra a Caja/Finanzas y abre Pérdida o merma.',
                'Selecciona el producto y la cantidad afectada.',
                'Registra el motivo para conservar trazabilidad.',
                'La merma reduce existencias sin fingir que hubo una venta.'
            ]
        },
        {
            id: 'sat', titulo: 'Factura y porcentaje SAT', pestana: 'opciones',
            palabras: ['sat','factura','impuesto','5 por ciento','porcentaje sat'],
            fuertes: ['cambiar sat','porcentaje sat','cuando cobra sat','factura cliente'],
            pasos: [
                'La tasa SAT se configura en Opciones/Configuración del negocio.',
                'En una venta el impuesto se aplica únicamente cuando se marca que el cliente necesita factura.',
                'El sistema separa ese monto en el fondo SAT para no confundirlo con ganancia disponible.',
                'Si la tasa cambia legalmente, actualízala en configuración; no hace falta modificar cada producto.'
            ]
        },
        {
            id: 'clientes', titulo: 'Administrar clientes', pestana: 'opciones',
            palabras: ['cliente','clientes','nit','limite credito','datos cliente'],
            fuertes: ['crear cliente','editar cliente','donde clientes','limite de credito'],
            pasos: [
                'La administración de clientes está dentro de Opciones/Configuración.',
                'Guarda los datos necesarios para cotizaciones, anticipos y ventas a crédito.',
                'El límite de crédito ayuda a evitar que una nueva venta deje al cliente por encima del máximo permitido.'
            ]
        },
        {
            id: 'usuarios', titulo: 'Usuarios y permisos', pestana: 'opciones',
            palabras: ['usuario','empleado','permiso','pin','dueño','dueno'],
            fuertes: ['crear usuario','permisos empleado','cambiar pin','ver finanzas empleado'],
            pasos: [
                'En Opciones abre Usuarios.',
                'El Dueño puede crear empleados, asignar PIN y elegir qué secciones pueden usar.',
                'El permiso “Ver costos, márgenes y utilidades internas” controla la visibilidad financiera de empleados en la interfaz.',
                'El Dueño conserva acceso total. Para seguridad de servidor por empleado se requiere autenticación individual y reglas de Firebase.'
            ]
        },
        {
            id: 'configuracion', titulo: 'Configuración del negocio', pestana: 'opciones',
            palabras: ['configuracion','opciones','margen','luz tinta','moneda','nombre negocio'],
            fuertes: ['cambiar margen','cambiar luz','cambiar tinta','cambiar moneda','configurar negocio'],
            pasos: [
                'Abre Opciones y despliega únicamente la sección que quieras modificar.',
                'Desde ahí puedes ajustar datos del negocio, porcentaje SAT, nombres de costos/fondos, margen objetivo y otras preferencias.',
                'Los cambios de presentación no deben alterar las fórmulas contables ya registradas.'
            ]
        },
        {
            id: 'interfaz', titulo: 'Cambiar interfaz Profesional o Clásica', pestana: 'opciones',
            palabras: ['interfaz','profesional','clasico','clasica','apariencia modelo'],
            fuertes: ['cambiar interfaz','modo profesional','modo clasico'],
            pasos: [
                'En Opciones busca la preferencia del modelo visual.',
                'Elige Profesional o Clásico.',
                'La preferencia cambia la presentación, no los datos ni la lógica de ventas, inventario o finanzas.'
            ]
        },
        {
            id: 'resumen', titulo: 'Consultar ventas y utilidad por fecha', pestana: 'inicio',
            palabras: ['resumen','utilidad','ventas por dia','ventas por mes','rango fechas'],
            fuertes: ['ventas de hoy','utilidad del dia','utilidad del mes','rango personalizado'],
            pasos: [
                'En Inicio abre “Ventas y utilidad por día, mes o rango”.',
                'Elige Hoy, Mes o Rango personalizado.',
                'El resumen separa ventas realizadas, dinero cobrado, costo de productos, producción, SAT y utilidad neta.',
                'La gráfica permite comparar el comportamiento por día.'
            ]
        },
        {
            id: 'disenos', titulo: 'Buscar diseños y archivos', pestana: 'buscador',
            palabras: ['diseño','diseno','archivo corel','buscar archivo','carpeta diseño'],
            fuertes: ['buscar diseño','encontrar corel','donde esta archivo'],
            pasos: [
                'Abre Diseños.',
                'Usa palabras relacionadas con el archivo que buscas.',
                'El buscador ayuda a localizar coincidencias y mostrar su ubicación; no modifica tus archivos originales.'
            ]
        },
        {
            id: 'respaldo', titulo: 'Respaldar o restaurar información', pestana: 'opciones',
            palabras: ['respaldo','backup','restaurar','exportar datos','copia seguridad'],
            fuertes: ['hacer respaldo','restaurar respaldo','copia de seguridad'],
            pasos: [
                'En Opciones utiliza las herramientas de respaldo del sistema.',
                'Guarda copias antes de cambios importantes o migraciones.',
                'Al restaurar, revisa cuidadosamente que el archivo corresponda al negocio y versión esperados antes de confirmar.'
            ]
        },
        {
            id: 'centro_inteligente', titulo: 'Usar el Centro Inteligente', pestana: 'inicio',
            palabras: ['centro inteligente','inteligencia','preguntar sistema','asistente','pregunta'],
            fuertes: ['como usar centro inteligente','que puedo preguntar','preguntar al sistema'],
            pasos: [
                'En Inicio abre Centro Inteligente.',
                'Puedes pedir análisis de datos como “ventas de hoy”, “qué debo surtir” o “cuánto hay en caja”.',
                'También puedes preguntar cómo usar funciones: préstamos, devoluciones, ventas, ingresos, SAT, usuarios y más.',
                'Las respuestas de ayuda son locales y no modifican inventario, ventas ni dinero. Las operaciones siguen requiriendo que tú las confirmes.'
            ]
        }
    ]);

    function puntuarEntrada(entrada, consulta) {
        let puntos = 0;
        entrada.fuertes.forEach(frase => {
            const f = normalizarTexto(frase);
            if(consulta.includes(f)) puntos += 12 + Math.min(5, f.split(' ').length);
        });
        entrada.palabras.forEach(palabra => {
            const p = normalizarTexto(palabra);
            if(consulta.includes(p)) puntos += p.includes(' ') ? 6 : 3;
        });
        if(consulta.includes('como') || consulta.includes('donde') || consulta.includes('ayuda')) puntos += 1;
        return puntos;
    }

    function buscarAyuda(consultaEntrada) {
        const consulta = normalizarTexto(consultaEntrada);
        if(!consulta) return { coincidencia: null, alternativas: [] };
        const puntuadas = CATALOGO
            .map(entrada => ({ entrada, puntos: puntuarEntrada(entrada, consulta) }))
            .filter(x => x.puntos > 0)
            .sort((a,b) => b.puntos - a.puntos || a.entrada.titulo.localeCompare(b.entrada.titulo));
        const mejor = puntuadas[0];
        return {
            coincidencia: mejor && mejor.puntos >= 4 ? { ...mejor.entrada, puntos: mejor.puntos } : null,
            alternativas: puntuadas.slice(mejor ? 1 : 0, 4).map(x => ({ id:x.entrada.id, titulo:x.entrada.titulo, pestana:x.entrada.pestana, puntos:x.puntos }))
        };
    }

    function calcularDisponibilidadPrestamo(saldosEntrada, fondosEntrada) {
        const saldos = saldosEntrada && typeof saldosEntrada === 'object' ? saldosEntrada : {};
        const fondos = fondosEntrada && typeof fondosEntrada === 'object' ? fondosEntrada : {};
        const efectivo = Math.max(0, numero(saldos.efectivo));
        const banco = Math.max(0, numero(saldos.banco));
        const disponibleSinSAT = Math.max(0,
            numero(fondos.costoProducto) + numero(fondos.costoLuzTinta) + numero(fondos.gananciaLibre)
        );
        const satProtegido = Math.max(0, numero(fondos.fondoImpuestos));
        return {
            efectivo,
            banco,
            disponibleSinSAT,
            satProtegido,
            maximoEfectivo: Math.min(efectivo, disponibleSinSAT),
            maximoBanco: Math.min(banco, disponibleSinSAT)
        };
    }

    function validarPrestamoLocal(montoEntrada, origenEntrada, saldos, fondos) {
        const monto = numero(montoEntrada);
        const origen = origenEntrada === 'banco' ? 'banco' : 'efectivo';
        const d = calcularDisponibilidadPrestamo(saldos, fondos);
        const saldoOrigen = origen === 'banco' ? d.banco : d.efectivo;
        const maximo = origen === 'banco' ? d.maximoBanco : d.maximoEfectivo;
        if(!(monto > 0)) return { ok:false, razon:'monto', origen, monto, saldoOrigen, maximo, disponibilidad:d };
        if(monto - saldoOrigen > 0.000001) return { ok:false, razon:'ubicacion', origen, monto, saldoOrigen, maximo, disponibilidad:d };
        if(monto - d.disponibleSinSAT > 0.000001) return { ok:false, razon:'sat', origen, monto, saldoOrigen, maximo, disponibilidad:d };
        return { ok:true, razon:'ok', origen, monto, saldoOrigen, maximo, disponibilidad:d };
    }

    function esPreguntaUso(consulta) {
        return contiene(consulta, ['como','donde','ayuda','que significa','para que sirve','quiero hacer','como hago','como puedo','que puedo preguntar']);
    }

    function responderConsulta(consultaEntrada, contexto = {}) {
        const consulta = normalizarTexto(consultaEntrada);
        if(!consulta) return { tipo:'vacia' };

        if(contiene(consulta, ['que puedo preguntar','que sabes hacer','ayuda del sistema','ayudame con el sistema'])) {
            return {
                tipo:'capacidades',
                titulo:'Puedo ayudarte a usar SubliCosturas',
                texto:'Puedo explicar pasos de uso y también dejar que el analizador actual responda consultas de datos del negocio.',
                ejemplos:['¿Cómo registro un préstamo?','¿Cómo ingreso un producto?','¿Cómo hago una venta a crédito?','¿Dónde cambio el SAT?','¿Qué debo surtir?','¿Cuánto hay en caja?']
            };
        }

        const preguntaPrestamo = contiene(consulta, ['prestamo','prestar','prestado']);
        if(preguntaPrestamo && contiene(consulta, ['cuanto puedo','disponible','cuanto hay','maximo','alcanza'])) {
            const d = calcularDisponibilidadPrestamo(contexto.saldosDinero, contexto.fondos);
            return { tipo:'disponibilidad_prestamo', titulo:'Disponibilidad para prestar', disponibilidad:d, pestana:'caja' };
        }

        if(preguntaPrestamo && contiene(consulta, ['pendiente','vencido','vence','quien debe','quien me debe'])) {
            const lista = Array.isArray(contexto.prestamos) ? contexto.prestamos.filter(p => numero(p.saldoPendiente) > 0 && p.estado !== 'anulado') : [];
            const hoy = contexto.ahora ? new Date(contexto.ahora) : new Date();
            hoy.setHours(0,0,0,0);
            const resumen = lista.map(p => {
                const f = p.vencimiento ? new Date(`${p.vencimiento}T00:00:00`) : null;
                const dias = f && !Number.isNaN(f.getTime()) ? Math.round((f.getTime() - hoy.getTime()) / 86400000) : null;
                return { persona:String(p.persona || 'PERSONA'), saldoPendiente:numero(p.saldoPendiente), vencimiento:p.vencimiento || '', dias };
            }).sort((a,b) => (a.dias ?? 999999) - (b.dias ?? 999999));
            return { tipo:'prestamos_pendientes', titulo:'Préstamos pendientes', prestamos:resumen, pestana:'caja' };
        }

        const ayuda = buscarAyuda(consulta);
        if(ayuda.coincidencia && (esPreguntaUso(consulta) || ayuda.coincidencia.puntos >= 10)) {
            return { tipo:'ayuda', ...ayuda.coincidencia, alternativas:ayuda.alternativas };
        }

        if(esPreguntaUso(consulta)) {
            return { tipo:'no_encontrada', alternativas:ayuda.alternativas };
        }

        return { tipo:'delegar' };
    }

    const api = Object.freeze({
        normalizarTexto,
        buscarAyuda,
        calcularDisponibilidadPrestamo,
        validarPrestamoLocal,
        responderConsulta,
        catalogo: CATALOGO
    });

    global.SubliAsistenteCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
