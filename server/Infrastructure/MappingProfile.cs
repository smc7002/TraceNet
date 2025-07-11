using AutoMapper;
using TraceNet.Models;
using TraceNet.DTOs;

namespace TraceNet.Infrastructure
{
    /// <summary>
    /// AutoMapper 프로파일: 모델과 DTO 간의 매핑 규칙 정의
    /// </summary>
    public class MappingProfile : Profile
    {
        public MappingProfile()
        {
            // Device → DeviceDto 변환 매핑
            CreateMap<Device, DeviceDto>()
                .ForMember(dest => dest.DeviceId, opt => opt.MapFrom(src => src.DeviceId))
                .ForMember(dest => dest.Name, opt => opt.MapFrom(src => src.Name))
                .ForMember(dest => dest.Type, opt => opt.MapFrom(src => src.Type))
                .ForMember(dest => dest.Status, opt => opt.Ignore())       // 나중에 Ping/Trace 로직에서 설정
                .ForMember(dest => dest.IpAddress, opt => opt.MapFrom(src => src.IPAddress))
                .ForMember(dest => dest.RackName, opt => opt.MapFrom(src => src.Rack != null ? src.Rack.Name : null));
        }
    }
}
