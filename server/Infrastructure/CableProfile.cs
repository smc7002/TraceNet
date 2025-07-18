using AutoMapper;
using TraceNet.DTOs;
using TraceNet.Models;

namespace TraceNet.Infrastructure
{
    public class CableProfile : Profile
    {
        public CableProfile()
        {
            CreateMap<CableConnection, CableDto>()
    .ForMember(dest => dest.CableId, opt => opt.MapFrom(src => src.Cable.CableId))
    .ForMember(dest => dest.Description, opt => opt.MapFrom(src => src.Cable.Description))
    .ForMember(dest => dest.FromDevice, opt => opt.MapFrom(src => src.FromPort.Device.Name))
    .ForMember(dest => dest.FromPort, opt => opt.MapFrom(src => src.FromPort.Name))
    .ForMember(dest => dest.ToDevice, opt => opt.MapFrom(src => src.ToPort.Device.Name))
    .ForMember(dest => dest.ToPort, opt => opt.MapFrom(src => src.ToPort.Name))
    .ForMember(dest => dest.FromDeviceId, opt => opt.MapFrom(src => src.FromPort.Device.DeviceId))
    .ForMember(dest => dest.ToDeviceId, opt => opt.MapFrom(src => src.ToPort.Device.DeviceId));

        }
    }
}
