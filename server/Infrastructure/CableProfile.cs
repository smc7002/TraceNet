using AutoMapper;
using TraceNet.DTOs;
using TraceNet.Models;

namespace TraceNet.Infrastructure
{
    /// <summary>
    /// 케이블 연결 정보를 DTO로 변환하는 AutoMapper 프로필
    /// CableConnection (복합 엔티티) → CableDto (평면 구조) 매핑
    /// </summary>
    public class CableProfile : Profile
    {
        public CableProfile()
        {
            // CableConnection은 Cable + FromPort + ToPort 관계를 포함하는 복합 엔티티
            // CableDto는 프론트엔드에서 사용하기 쉬운 평면 구조
            CreateMap<CableConnection, CableDto>()
                
                // 케이블 기본 정보 (Cable 엔티티에서)
                .ForMember(dest => dest.CableId, opt => opt.MapFrom(src => src.Cable.CableId))
                .ForMember(dest => dest.Description, opt => opt.MapFrom(src => src.Cable.Description))
                
                // 출발점 정보 (FromPort → Device 경로)
                .ForMember(dest => dest.FromDevice, opt => opt.MapFrom(src => src.FromPort.Device.Name))
                .ForMember(dest => dest.FromPort, opt => opt.MapFrom(src => src.FromPort.Name))
                .ForMember(dest => dest.FromDeviceId, opt => opt.MapFrom(src => src.FromPort.Device.DeviceId))
                
                // 도착점 정보 (ToPort → Device 경로)
                .ForMember(dest => dest.ToDevice, opt => opt.MapFrom(src => src.ToPort.Device.Name))
                .ForMember(dest => dest.ToPort, opt => opt.MapFrom(src => src.ToPort.Name))
                .ForMember(dest => dest.ToDeviceId, opt => opt.MapFrom(src => src.ToPort.Device.DeviceId));
        }
    }

    /*
     * 매핑 구조 설명:
     * 
     * [데이터베이스] 
     * CableConnection
     * ├── Cable (케이블 정보)
     * │   ├── CableId
     * │   └── Description
     * ├── FromPort (출발 포트)
     * │   ├── Name
     * │   └── Device
     * │       ├── Name
     * │       └── DeviceId
     * └── ToPort (도착 포트)
     *     ├── Name
     *     └── Device
     *         ├── Name
     *         └── DeviceId
     * 
     * [API 응답]
     * CableDto 
     * ├── CableId, Description
     * ├── FromDevice, FromPort, FromDeviceId
     * └── ToDevice, ToPort, ToDeviceId
     * 
     * 프론트엔드에서 중첩 객체 접근 없이 바로 사용 가능
     */
}