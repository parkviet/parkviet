//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:pos_api/src/model/overview_status_counts.dart';
import 'package:pos_api/src/model/overview_stock_alerts.dart';
import 'package:pos_api/src/model/date.dart';
import 'package:pos_api/src/model/overview_totals.dart';
import 'package:built_collection/built_collection.dart';
import 'package:pos_api/src/model/overview_day.dart';
import 'package:pos_api/src/model/owner_hour_row.dart';
import 'package:pos_api/src/model/owner_source_row.dart';
import 'package:pos_api/src/model/overview_top_items.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'overview.g.dart';

/// Overview
///
/// Properties:
/// * [branchId]
/// * [timezone]
/// * [scope]
/// * [from]
/// * [to]
/// * [previousFrom]
/// * [previousTo]
/// * [totals]
/// * [previousTotals]
/// * [byDay]
/// * [previousByDay]
/// * [byHour]
/// * [bySource]
/// * [topItems]
/// * [statusCounts]
/// * [stockAlerts] - Null for readers who cannot see the branch's stock alerts.
@BuiltValue()
abstract class Overview implements Built<Overview, OverviewBuilder> {
  @BuiltValueField(wireName: r'branch_id')
  String get branchId;

  @BuiltValueField(wireName: r'timezone')
  String get timezone;

  @BuiltValueField(wireName: r'scope')
  OverviewScopeEnum get scope;
  // enum scopeEnum {  branch,  own,  };

  @BuiltValueField(wireName: r'from')
  Date get from;

  @BuiltValueField(wireName: r'to')
  Date get to;

  @BuiltValueField(wireName: r'previous_from')
  Date? get previousFrom;

  @BuiltValueField(wireName: r'previous_to')
  Date? get previousTo;

  @BuiltValueField(wireName: r'totals')
  OverviewTotals get totals;

  @BuiltValueField(wireName: r'previous_totals')
  OverviewTotals? get previousTotals;

  @BuiltValueField(wireName: r'by_day')
  BuiltList<OverviewDay> get byDay;

  @BuiltValueField(wireName: r'previous_by_day')
  BuiltList<OverviewDay>? get previousByDay;

  @BuiltValueField(wireName: r'by_hour')
  BuiltList<OwnerHourRow> get byHour;

  @BuiltValueField(wireName: r'by_source')
  BuiltList<OwnerSourceRow> get bySource;

  @BuiltValueField(wireName: r'top_items')
  OverviewTopItems get topItems;

  @BuiltValueField(wireName: r'status_counts')
  OverviewStatusCounts get statusCounts;

  /// Null for readers who cannot see the branch's stock alerts.
  @BuiltValueField(wireName: r'stock_alerts')
  OverviewStockAlerts? get stockAlerts;

  Overview._();

  factory Overview([void updates(OverviewBuilder b)]) = _$Overview;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(OverviewBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<Overview> get serializer => _$OverviewSerializer();
}

class _$OverviewSerializer implements PrimitiveSerializer<Overview> {
  @override
  final Iterable<Type> types = const [Overview, _$Overview];

  @override
  final String wireName = r'Overview';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    Overview object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'branch_id';
    yield serializers.serialize(
      object.branchId,
      specifiedType: const FullType(String),
    );
    yield r'timezone';
    yield serializers.serialize(
      object.timezone,
      specifiedType: const FullType(String),
    );
    yield r'scope';
    yield serializers.serialize(
      object.scope,
      specifiedType: const FullType(OverviewScopeEnum),
    );
    yield r'from';
    yield serializers.serialize(
      object.from,
      specifiedType: const FullType(Date),
    );
    yield r'to';
    yield serializers.serialize(
      object.to,
      specifiedType: const FullType(Date),
    );
    yield r'previous_from';
    yield object.previousFrom == null
        ? null
        : serializers.serialize(
            object.previousFrom,
            specifiedType: const FullType.nullable(Date),
          );
    yield r'previous_to';
    yield object.previousTo == null
        ? null
        : serializers.serialize(
            object.previousTo,
            specifiedType: const FullType.nullable(Date),
          );
    yield r'totals';
    yield serializers.serialize(
      object.totals,
      specifiedType: const FullType(OverviewTotals),
    );
    yield r'previous_totals';
    yield object.previousTotals == null
        ? null
        : serializers.serialize(
            object.previousTotals,
            specifiedType: const FullType.nullable(OverviewTotals),
          );
    yield r'by_day';
    yield serializers.serialize(
      object.byDay,
      specifiedType: const FullType(BuiltList, [FullType(OverviewDay)]),
    );
    yield r'previous_by_day';
    yield object.previousByDay == null
        ? null
        : serializers.serialize(
            object.previousByDay,
            specifiedType:
                const FullType.nullable(BuiltList, [FullType(OverviewDay)]),
          );
    yield r'by_hour';
    yield serializers.serialize(
      object.byHour,
      specifiedType: const FullType(BuiltList, [FullType(OwnerHourRow)]),
    );
    yield r'by_source';
    yield serializers.serialize(
      object.bySource,
      specifiedType: const FullType(BuiltList, [FullType(OwnerSourceRow)]),
    );
    yield r'top_items';
    yield serializers.serialize(
      object.topItems,
      specifiedType: const FullType(OverviewTopItems),
    );
    yield r'status_counts';
    yield serializers.serialize(
      object.statusCounts,
      specifiedType: const FullType(OverviewStatusCounts),
    );
    yield r'stock_alerts';
    yield object.stockAlerts == null
        ? null
        : serializers.serialize(
            object.stockAlerts,
            specifiedType: const FullType.nullable(OverviewStockAlerts),
          );
  }

  @override
  Object serialize(
    Serializers serializers,
    Overview object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object,
            specifiedType: specifiedType)
        .toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required OverviewBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'branch_id':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.branchId = valueDes;
          break;
        case r'timezone':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.timezone = valueDes;
          break;
        case r'scope':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(OverviewScopeEnum),
          ) as OverviewScopeEnum;
          result.scope = valueDes;
          break;
        case r'from':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(Date),
          ) as Date;
          result.from = valueDes;
          break;
        case r'to':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(Date),
          ) as Date;
          result.to = valueDes;
          break;
        case r'previous_from':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(Date),
          ) as Date?;
          if (valueDes == null) continue;
          result.previousFrom = valueDes;
          break;
        case r'previous_to':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(Date),
          ) as Date?;
          if (valueDes == null) continue;
          result.previousTo = valueDes;
          break;
        case r'totals':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(OverviewTotals),
          ) as OverviewTotals;
          result.totals.replace(valueDes);
          break;
        case r'previous_totals':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(OverviewTotals),
          ) as OverviewTotals?;
          if (valueDes == null) continue;
          result.previousTotals.replace(valueDes);
          break;
        case r'by_day':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(OverviewDay)]),
          ) as BuiltList<OverviewDay>;
          result.byDay.replace(valueDes);
          break;
        case r'previous_by_day':
          final valueDes = serializers.deserialize(
            value,
            specifiedType:
                const FullType.nullable(BuiltList, [FullType(OverviewDay)]),
          ) as BuiltList<OverviewDay>?;
          if (valueDes == null) continue;
          result.previousByDay.replace(valueDes);
          break;
        case r'by_hour':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltList, [FullType(OwnerHourRow)]),
          ) as BuiltList<OwnerHourRow>;
          result.byHour.replace(valueDes);
          break;
        case r'by_source':
          final valueDes = serializers.deserialize(
            value,
            specifiedType:
                const FullType(BuiltList, [FullType(OwnerSourceRow)]),
          ) as BuiltList<OwnerSourceRow>;
          result.bySource.replace(valueDes);
          break;
        case r'top_items':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(OverviewTopItems),
          ) as OverviewTopItems;
          result.topItems.replace(valueDes);
          break;
        case r'status_counts':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(OverviewStatusCounts),
          ) as OverviewStatusCounts;
          result.statusCounts.replace(valueDes);
          break;
        case r'stock_alerts':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType.nullable(OverviewStockAlerts),
          ) as OverviewStockAlerts?;
          if (valueDes == null) continue;
          result.stockAlerts.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  Overview deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = OverviewBuilder();
    final serializedList = (serialized as Iterable<Object?>).toList();
    final unhandled = <Object?>[];
    _deserializeProperties(
      serializers,
      serialized,
      specifiedType: specifiedType,
      serializedList: serializedList,
      unhandled: unhandled,
      result: result,
    );
    return result.build();
  }
}

class OverviewScopeEnum extends EnumClass {
  @BuiltValueEnumConst(wireName: r'branch')
  static const OverviewScopeEnum branch = _$overviewScopeEnum_branch;
  @BuiltValueEnumConst(wireName: r'own')
  static const OverviewScopeEnum own = _$overviewScopeEnum_own;

  static Serializer<OverviewScopeEnum> get serializer =>
      _$overviewScopeEnumSerializer;

  const OverviewScopeEnum._(String name) : super(name);

  static BuiltSet<OverviewScopeEnum> get values => _$overviewScopeEnumValues;
  static OverviewScopeEnum valueOf(String name) =>
      _$overviewScopeEnumValueOf(name);
}
